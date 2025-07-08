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
 * DeepSeek model client
 */
export class DeepSeekModelClient extends BaseModelClient {
  readonly provider = ModelProvider.DEEPSEEK;

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
        console.log('DeepSeek API request:', { url, headers: { ...headers, Authorization: 'Bearer [REDACTED]' }, body });
      }

      const response = await this.makeRequest(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      });

      if (process.env.DEBUG) {
        console.log('DeepSeek API response:', { success: response.success, status: response.response?.status, error: response.error });
      }

      if (!response.success) {
        const status = response.response?.status || 'unknown';
        const errorMsg = `DeepSeek API error (${status}): ${response.error}`;
        throw new Error(errorMsg);
      }

      return this.transformResponse(response.data);
    } catch (error) {
      // Re-throw with better error context but don't log to stderr
      if (error instanceof Error) {
        throw new Error(`DeepSeek API failed: ${error.message}`);
      }
      throw new Error('DeepSeek API failed with unknown error');
    }
  }

  async* generateContentStream(request: GenerationRequest): AsyncGenerator<StreamingChunk> {
    try {
      const url = this.buildApiUrl('chat/completions');
      const body = { ...this.buildRequestBody(request), stream: true };
      const headers = this.buildHeaders();

      if (process.env.DEBUG) {
        console.log('DeepSeek streaming request:', { url, headers: { ...headers, Authorization: 'Bearer [REDACTED]' }, body });
      }

      for await (const chunk of this.makeStreamingRequest(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      })) {
        if (!chunk.success) {
          throw new Error(`DeepSeek API streaming error: ${chunk.error}`);
        }

        if (chunk.done) {
          if (process.env.DEBUG) {
            console.log('DeepSeek streaming completed');
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
        throw new Error(`DeepSeek streaming failed: ${error.message}`);
      }
      throw new Error('DeepSeek streaming failed with unknown error');
    }
  }

  async countTokens(request: TokenCountRequest): Promise<TokenCountResponse> {
    // DeepSeek doesn't have a direct token counting API
    // We'll estimate based on message content
    const totalText = request.messages
      .map(msg => this.extractTextFromContent(msg.content))
      .join('\n');
    
    // Rough estimation: ~4 characters per token
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
    const baseUrl = this.config.baseUrl || 'https://api.deepseek.com';
    const version = this.config.apiVersion || 'v1';
    return `${baseUrl}/${version}/${endpoint}`;
  }

  private buildHeaders(): Record<string, string> {
    return {
      'Authorization': `Bearer ${(this.authConfig as any).apiKey}`,
      'Content-Type': 'application/json',
    };
  }

  private buildRequestBody(request: GenerationRequest): any {
    const messages = this.transformMessages(request.messages);
    
    const body: any = {
      model: this.config.model,
      messages,
      max_tokens: request.parameters?.maxTokens || 1000,
    };

    if (request.parameters?.temperature !== undefined) {
      body.temperature = request.parameters.temperature;
    }

    if (request.parameters?.topP !== undefined) {
      body.top_p = request.parameters.topP;
    }

    if (request.parameters?.stopSequences?.length) {
      body.stop = request.parameters.stopSequences;
    }

    if (request.tools?.length) {
      body.tools = this.transformTools(request.tools);
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
    const choice = data.choices?.[0];
    if (!choice) {
      throw new Error('No choices in DeepSeek response');
    }

    const message: ChatMessage = {
      role: 'assistant',
      content: choice.message?.content || ''
    };

    if (choice.message?.tool_calls?.length) {
      message.toolCalls = choice.message.tool_calls.map((toolCall: any) => ({
        id: toolCall.id,
        type: 'function',
        function: {
          name: toolCall.function.name,
          arguments: toolCall.function.arguments
        }
      }));
    }

    return {
      id: data.id || this.generateRequestId(),
      model: data.model || this.config.model,
      created: data.created || this.getCurrentTimestamp(),
      choices: [{
        index: 0,
        message,
        finishReason: this.mapFinishReason(choice.finish_reason)
      }],
      usage: data.usage ? {
        promptTokens: data.usage.prompt_tokens || 0,
        completionTokens: data.usage.completion_tokens || 0,
        totalTokens: data.usage.total_tokens || 0
      } : undefined
    };
  }

  private transformStreamingChunk(data: any): StreamingChunk | null {
    if (data.choices?.[0]?.delta) {
      const delta = data.choices[0].delta;
      
      return {
        id: data.id || this.generateRequestId(),
        model: data.model || this.config.model,
        created: data.created || this.getCurrentTimestamp(),
        choices: [{
          index: 0,
          delta: {
            content: delta.content || undefined,
            toolCalls: delta.tool_calls ? delta.tool_calls.map((toolCall: any) => ({
              id: toolCall.id,
              type: 'function',
              function: {
                name: toolCall.function?.name,
                arguments: toolCall.function?.arguments
              }
            })) : undefined
          },
          finishReason: this.mapFinishReason(data.choices[0].finish_reason)
        }],
        usage: data.usage ? {
          promptTokens: data.usage.prompt_tokens || 0,
          completionTokens: data.usage.completion_tokens || 0,
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