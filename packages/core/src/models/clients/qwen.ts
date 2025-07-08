/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import { BaseModelClient } from './base.js';
import { 
  ModelProvider,
  ModelConfig,
  GenerationRequest,
  GenerationResponse,
  StreamingChunk,
  TokenCountRequest,
  TokenCountResponse,
  ChatMessage,
  ToolCall
} from '../types.js';
import { AuthConfig } from '../../auth/types.js';

/**
 * Qwen model client
 */
export class QwenModelClient extends BaseModelClient {
  readonly provider = ModelProvider.QWEN;

  constructor(config: ModelConfig, authConfig: AuthConfig) {
    super(config, authConfig);
  }

  async generateContent(request: GenerationRequest): Promise<GenerationResponse> {
    try {
      const url = this.buildApiUrl('chat/completions');
      const body = this.buildRequestBody(request);
      const headers = this.buildHeaders();

      // Debug logging (safe)
      if (process.env.DEBUG) {
        console.log('Qwen API request:', { url, headers: { ...headers, Authorization: 'Bearer [REDACTED]' }, body });
      }

      const response = await this.makeRequest(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      });

      if (process.env.DEBUG) {
        console.log('Qwen API response:', { success: response.success, status: response.response?.status, error: response.error });
      }

      if (!response.success) {
        const status = response.response?.status || 'unknown';
        const errorMsg = `Qwen API error (${status}): ${response.error}`;
        throw new Error(errorMsg);
      }

      return this.transformResponse(response.data);
    } catch (error) {
      // Re-throw with better error context but don't log to stderr
      if (error instanceof Error) {
        throw new Error(`Qwen API failed: ${error.message}`);
      }
      throw new Error('Qwen API failed with unknown error');
    }
  }

  async* generateContentStream(request: GenerationRequest): AsyncGenerator<StreamingChunk> {
    try {
      const url = this.buildApiUrl('chat/completions');
      const body = { ...this.buildRequestBody(request), stream: true };
      const headers = this.buildHeaders();

      if (process.env.DEBUG) {
        console.log('Qwen streaming request:', { url, headers: { ...headers, Authorization: 'Bearer [REDACTED]' }, body });
      }

      for await (const chunk of this.makeStreamingRequest(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      })) {
        if (!chunk.success) {
          throw new Error(`Qwen API streaming error: ${chunk.error}`);
        }

        if (chunk.done) {
          if (process.env.DEBUG) {
            console.log('Qwen streaming completed');
          }
          return;
        }

        if (chunk.data) {
          const transformedChunk = this.transformStreamingChunk(chunk.data);
          if (transformedChunk) {
            yield transformedChunk;
          }
        }
      }
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Qwen streaming failed: ${error.message}`);
      }
      throw new Error('Qwen streaming failed with unknown error');
    }
  }

  async countTokens(request: TokenCountRequest): Promise<TokenCountResponse> {
    // Qwen doesn't have a direct token counting API
    // We'll estimate based on message content
    const totalText = request.messages
      .map(msg => this.extractTextFromContent(msg.content))
      .join('\n');
    
    // Rough estimation: ~4 characters per token for Chinese/English mixed content
    const estimatedTokens = Math.ceil(totalText.length / 4);
    
    return {
      totalTokens: estimatedTokens,
      promptTokens: estimatedTokens,
      metadata: { estimated: true }
    };
  }

  async validate(): Promise<boolean> {
    try {
      // Test with a simple request
      const testRequest: GenerationRequest = {
        messages: [{ role: 'user', content: 'Hello' }],
        parameters: { maxTokens: 1 }
      };
      
      await this.generateContent(testRequest);
      return true;
    } catch {
      return false;
    }
  }

  private buildApiUrl(endpoint: string): string {
    // Default to DashScope API for Qwen models
    const baseUrl = this.config.baseUrl || 'https://dashscope.aliyuncs.com/api';
    const version = this.config.apiVersion || 'v1';
    return `${baseUrl}/${version}/services/aigc/text-generation/generation`;
  }

  private buildHeaders(): Record<string, string> {
    return {
      'Authorization': `Bearer ${(this.authConfig as any).apiKey}`,
      'Content-Type': 'application/json',
      'X-DashScope-SSE': 'enable', // Enable streaming for DashScope
    };
  }

  private buildRequestBody(request: GenerationRequest): any {
    const messages = this.transformMessages(request.messages);
    
    const body: any = {
      model: this.config.model,
      input: {
        messages
      },
      parameters: {
        max_tokens: request.parameters?.maxTokens || 1000,
        temperature: request.parameters?.temperature || 0.7,
        top_p: request.parameters?.topP || 0.8,
        repetition_penalty: 1.05,
        incremental_output: true
      }
    };

    if (request.parameters?.stopSequences?.length) {
      body.parameters.stop = request.parameters.stopSequences;
    }

    if (request.tools?.length) {
      body.parameters.tools = this.transformTools(request.tools);
    }

    return body;
  }

  private transformMessages(messages: ChatMessage[]): any[] {
    return messages.map(message => {
      if (typeof message.content === 'string') {
        return {
          role: message.role === 'assistant' ? 'assistant' : message.role === 'system' ? 'system' : 'user',
          content: message.content
        };
      } else {
        // Handle multipart content
        const content = message.content.map(part => {
          if (part.type === 'text') {
            return { type: 'text', text: part.text };
          } else if (part.type === 'image') {
            return {
              type: 'image_url',
              image_url: {
                url: part.data ? `data:${part.mimeType || 'image/jpeg'};base64,${part.data}` : part.imageUrl
              }
            };
          }
          return null;
        }).filter(Boolean);

        return {
          role: message.role === 'assistant' ? 'assistant' : message.role === 'system' ? 'system' : 'user',
          content
        };
      }
    });
  }

  private transformTools(tools: any[]): any[] {
    return tools.map(tool => ({
      type: 'function',
      function: {
        name: tool.function.name,
        description: tool.function.description,
        parameters: tool.function.parameters
      }
    }));
  }

  private transformResponse(data: any): GenerationResponse {
    // DashScope API has a different response format
    const output = data.output;
    if (!output) {
      throw new Error('No output in Qwen response');
    }

    const message: ChatMessage = {
      role: 'assistant',
      content: output.text || ''
    };

    if (output.tool_calls?.length) {
      message.toolCalls = output.tool_calls.map((toolCall: any) => ({
        id: toolCall.id || this.generateRequestId(),
        type: 'function',
        function: {
          name: toolCall.function.name,
          arguments: JSON.stringify(toolCall.function.arguments)
        }
      }));
    }

    return {
      id: data.request_id || this.generateRequestId(),
      model: this.config.model,
      created: this.getCurrentTimestamp(),
      choices: [{
        index: 0,
        message,
        finishReason: this.mapFinishReason(output.finish_reason)
      }],
      usage: data.usage ? {
        promptTokens: data.usage.input_tokens || 0,
        completionTokens: data.usage.output_tokens || 0,
        totalTokens: data.usage.total_tokens || 0
      } : undefined
    };
  }

  private transformStreamingChunk(data: any): StreamingChunk | null {
    const output = data.output;
    if (output) {
      return {
        id: data.request_id || this.generateRequestId(),
        model: this.config.model,
        created: this.getCurrentTimestamp(),
        choices: [{
          index: 0,
          delta: {
            content: output.text || undefined,
            toolCalls: output.tool_calls ? output.tool_calls.map((toolCall: any) => ({
              id: toolCall.id || this.generateRequestId(),
              type: 'function',
              function: {
                name: toolCall.function?.name,
                arguments: JSON.stringify(toolCall.function?.arguments || {})
              }
            })) : undefined
          },
          finishReason: this.mapFinishReason(output.finish_reason)
        }],
        usage: data.usage ? {
          promptTokens: data.usage.input_tokens || 0,
          completionTokens: data.usage.output_tokens || 0,
          totalTokens: data.usage.total_tokens || 0
        } : undefined
      };
    }

    return null;
  }

  private mapFinishReason(reason: string | undefined): 'stop' | 'length' | 'tool_calls' | 'content_filter' | null {
    switch (reason) {
      case 'stop':
        return 'stop';
      case 'length':
        return 'length';
      case 'tool_calls':
        return 'tool_calls';
      case 'content_filter':
        return 'content_filter';
      default:
        return null;
    }
  }
}