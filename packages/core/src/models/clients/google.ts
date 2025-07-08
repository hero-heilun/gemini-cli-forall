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
import { AuthConfig, AuthMethod } from '../../auth/types.js';

/**
 * Google Gemini model client
 */
export class GoogleModelClient extends BaseModelClient {
  readonly provider = ModelProvider.GOOGLE_GEMINI;

  constructor(config: ModelConfig, authConfig: AuthConfig) {
    super(config, authConfig);
  }

  async generateContent(request: GenerationRequest): Promise<GenerationResponse> {
    const url = this.buildApiUrl('generateContent');
    const body = this.buildRequestBody(request);
    const headers = this.buildHeaders();

    const response = await this.makeRequest(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });

    if (!response.success) {
      throw new Error(`Google API error: ${response.error}`);
    }

    return this.transformResponse(response.data);
  }

  async* generateContentStream(request: GenerationRequest): AsyncGenerator<StreamingChunk> {
    const url = this.buildApiUrl('streamGenerateContent');
    const body = this.buildRequestBody(request);
    const headers = this.buildHeaders();

    for await (const chunk of this.makeStreamingRequest(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    })) {
      if (!chunk.success) {
        throw new Error(`Google API streaming error: ${chunk.error}`);
      }

      if (chunk.done) {
        return;
      }

      if (chunk.data) {
        yield this.transformStreamingChunk(chunk.data);
      }
    }
  }

  async countTokens(request: TokenCountRequest): Promise<TokenCountResponse> {
    const url = this.buildApiUrl('countTokens');
    const body = this.buildTokenCountBody(request);
    const headers = this.buildHeaders();

    const response = await this.makeRequest(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });

    if (!response.success) {
      throw new Error(`Google API token count error: ${response.error}`);
    }

    return {
      totalTokens: response.data.totalTokens,
      promptTokens: response.data.totalTokens,
      metadata: response.data
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
    const baseUrl = this.config.baseUrl || 'https://generativelanguage.googleapis.com';
    const version = this.config.apiVersion || 'v1beta';
    return `${baseUrl}/${version}/models/${this.config.model}:${endpoint}`;
  }

  private buildHeaders(): Record<string, string> {
    const headers: Record<string, string> = {};

    switch (this.authConfig.method) {
      case AuthMethod.GOOGLE_API_KEY:
        headers['x-goog-api-key'] = (this.authConfig as any).apiKey;
        break;
      case AuthMethod.GOOGLE_OAUTH:
        headers['Authorization'] = `Bearer ${(this.authConfig as any).accessToken}`;
        break;
      case AuthMethod.GOOGLE_VERTEX_AI:
        if ((this.authConfig as any).apiKey) {
          headers['Authorization'] = `Bearer ${(this.authConfig as any).apiKey}`;
        }
        break;
      default:
        // Do nothing for unsupported methods
        break;
    }

    return headers;
  }

  private buildRequestBody(request: GenerationRequest): any {
    const contents = this.transformMessages(request.messages);
    const tools = request.tools ? this.transformTools(request.tools) : undefined;
    
    const body: any = {
      contents,
      generationConfig: {
        maxOutputTokens: request.parameters?.maxTokens,
        temperature: request.parameters?.temperature,
        topP: request.parameters?.topP,
        topK: request.parameters?.topK,
        stopSequences: request.parameters?.stopSequences,
      },
    };

    if (tools) {
      body.tools = tools;
    }

    if (request.parameters?.systemPrompt) {
      body.systemInstruction = {
        parts: [{ text: request.parameters.systemPrompt }]
      };
    }

    return body;
  }

  private buildTokenCountBody(request: TokenCountRequest): any {
    const contents = this.transformMessages(request.messages);
    const tools = request.tools ? this.transformTools(request.tools) : undefined;
    
    const body: any = { contents };
    if (tools) {
      body.tools = tools;
    }

    return body;
  }

  private transformMessages(messages: ChatMessage[]): any[] {
    const contents: any[] = [];
    
    for (const message of messages) {
      if (message.role === 'system') {
        // System messages are handled separately in Gemini
        continue;
      }

      const parts: any[] = [];
      
      if (typeof message.content === 'string') {
        parts.push({ text: message.content });
      } else {
        for (const part of message.content) {
          if (part.type === 'text') {
            parts.push({ text: part.text });
          } else if (part.type === 'image') {
            parts.push({
              inlineData: {
                mimeType: part.mimeType || 'image/jpeg',
                data: part.data
              }
            });
          }
        }
      }

      // Handle tool calls
      if (message.toolCalls) {
        for (const toolCall of message.toolCalls) {
          parts.push({
            functionCall: {
              name: toolCall.function.name,
              args: JSON.parse(toolCall.function.arguments)
            }
          });
        }
      }

      contents.push({
        role: message.role === 'assistant' ? 'model' : message.role,
        parts
      });
    }

    return contents;
  }

  private transformTools(tools: any[]): any[] {
    return tools.map(tool => ({
      functionDeclarations: [{
        name: tool.function.name,
        description: tool.function.description,
        parameters: tool.function.parameters
      }]
    }));
  }

  private transformResponse(data: any): GenerationResponse {
    const candidate = data.candidates?.[0];
    const content = candidate?.content;
    const parts = content?.parts || [];
    
    const message: ChatMessage = {
      role: 'assistant',
      content: ''
    };

    const toolCalls: ToolCall[] = [];
    let textContent = '';

    for (const part of parts) {
      if (part.text) {
        textContent += part.text;
      } else if (part.functionCall) {
        toolCalls.push({
          id: this.generateRequestId(),
          type: 'function',
          function: {
            name: part.functionCall.name,
            arguments: JSON.stringify(part.functionCall.args || {})
          }
        });
      }
    }

    message.content = textContent;
    if (toolCalls.length > 0) {
      message.toolCalls = toolCalls;
    }

    return {
      id: this.generateRequestId(),
      model: this.config.model,
      created: this.getCurrentTimestamp(),
      choices: [{
        index: 0,
        message,
        finishReason: this.mapFinishReason(candidate?.finishReason)
      }],
      usage: data.usageMetadata ? {
        promptTokens: data.usageMetadata.promptTokenCount || 0,
        completionTokens: data.usageMetadata.candidatesTokenCount || 0,
        totalTokens: data.usageMetadata.totalTokenCount || 0
      } : undefined
    };
  }

  private transformStreamingChunk(data: any): StreamingChunk {
    const candidate = data.candidates?.[0];
    const content = candidate?.content;
    const parts = content?.parts || [];
    
    const delta: Partial<ChatMessage> = {};
    
    for (const part of parts) {
      if (part.text) {
        delta.content = (delta.content || '') + part.text;
      }
      // Handle function calls in streaming if needed
    }

    return {
      id: this.generateRequestId(),
      model: this.config.model,
      created: this.getCurrentTimestamp(),
      choices: [{
        index: 0,
        delta,
        finishReason: this.mapFinishReason(candidate?.finishReason)
      }],
      usage: data.usageMetadata ? {
        promptTokens: data.usageMetadata.promptTokenCount || 0,
        completionTokens: data.usageMetadata.candidatesTokenCount || 0,
        totalTokens: data.usageMetadata.totalTokenCount || 0
      } : undefined
    };
  }

  private mapFinishReason(reason: string | undefined): 'stop' | 'length' | 'tool_calls' | 'content_filter' | null {
    switch (reason) {
      case 'STOP':
        return 'stop';
      case 'MAX_TOKENS':
        return 'length';
      case 'SAFETY':
        return 'content_filter';
      case 'RECITATION':
        return 'content_filter';
      default:
        return null;
    }
  }
}