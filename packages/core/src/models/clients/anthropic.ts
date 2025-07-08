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
 * Anthropic Claude model client
 */
export class AnthropicModelClient extends BaseModelClient {
  readonly provider = ModelProvider.ANTHROPIC_CLAUDE;

  constructor(config: ModelConfig, authConfig: AuthConfig) {
    super(config, authConfig);
  }

  async generateContent(request: GenerationRequest): Promise<GenerationResponse> {
    const url = this.buildApiUrl('messages');
    const body = this.buildRequestBody(request);
    const headers = this.buildHeaders();

    const response = await this.makeRequest(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });

    if (!response.success) {
      throw new Error(`Anthropic API error: ${response.error}`);
    }

    return this.transformResponse(response.data);
  }

  async* generateContentStream(request: GenerationRequest): AsyncGenerator<StreamingChunk> {
    const url = this.buildApiUrl('messages');
    const body = { ...this.buildRequestBody(request), stream: true };
    const headers = this.buildHeaders();

    for await (const chunk of this.makeStreamingRequest(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    })) {
      if (!chunk.success) {
        throw new Error(`Anthropic API streaming error: ${chunk.error}`);
      }

      if (chunk.done) {
        return;
      }

      if (chunk.data) {
        const transformedChunk = this.transformStreamingChunk(chunk.data);
        if (transformedChunk) {
          yield transformedChunk;
        }
      }
    }
  }

  async countTokens(request: TokenCountRequest): Promise<TokenCountResponse> {
    // Anthropic doesn't have a direct token counting API
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
    const baseUrl = this.config.baseUrl || 'https://api.anthropic.com';
    const version = this.config.apiVersion || 'v1';
    return `${baseUrl}/${version}/${endpoint}`;
  }

  private buildHeaders(): Record<string, string> {
    return {
      'x-api-key': (this.authConfig as any).apiKey,
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json',
    };
  }

  private buildRequestBody(request: GenerationRequest): any {
    const { systemPrompt, messages } = this.separateSystemMessage(request.messages);
    
    const body: any = {
      model: this.config.model,
      max_tokens: request.parameters?.maxTokens || 1000,
      messages: this.transformMessages(messages),
    };

    if (systemPrompt) {
      body.system = systemPrompt;
    }

    if (request.parameters?.temperature !== undefined) {
      body.temperature = request.parameters.temperature;
    }

    if (request.parameters?.topP !== undefined) {
      body.top_p = request.parameters.topP;
    }

    if (request.parameters?.stopSequences?.length) {
      body.stop_sequences = request.parameters.stopSequences;
    }

    if (request.tools?.length) {
      body.tools = this.transformTools(request.tools);
    }

    return body;
  }

  private separateSystemMessage(messages: ChatMessage[]): { systemPrompt?: string; messages: ChatMessage[] } {
    const systemMessages = messages.filter(msg => msg.role === 'system');
    const otherMessages = messages.filter(msg => msg.role !== 'system');
    
    const systemPrompt = systemMessages.length > 0 
      ? systemMessages.map(msg => this.extractTextFromContent(msg.content)).join('\n')
      : undefined;

    return { systemPrompt, messages: otherMessages };
  }

  private transformMessages(messages: ChatMessage[]): any[] {
    return messages.map(message => {
      const content: any[] = [];
      
      if (typeof message.content === 'string') {
        content.push({ type: 'text', text: message.content });
      } else {
        for (const part of message.content) {
          if (part.type === 'text') {
            content.push({ type: 'text', text: part.text });
          } else if (part.type === 'image') {
            content.push({
              type: 'image',
              source: {
                type: 'base64',
                media_type: part.mimeType || 'image/jpeg',
                data: part.data
              }
            });
          }
        }
      }

      // Handle tool calls for assistant messages
      if (message.toolCalls) {
        for (const toolCall of message.toolCalls) {
          content.push({
            type: 'tool_use',
            id: toolCall.id,
            name: toolCall.function.name,
            input: JSON.parse(toolCall.function.arguments)
          });
        }
      }

      // Handle tool responses
      if (message.role === 'tool') {
        return {
          role: 'user',
          content: [{
            type: 'tool_result',
            tool_use_id: message.toolCallId,
            content: message.content as string
          }]
        };
      }

      return {
        role: message.role,
        content
      };
    });
  }

  private transformTools(tools: any[]): any[] {
    return tools.map(tool => ({
      name: tool.function.name,
      description: tool.function.description,
      input_schema: tool.function.parameters
    }));
  }

  private transformResponse(data: any): GenerationResponse {
    const message: ChatMessage = {
      role: 'assistant',
      content: ''
    };

    const toolCalls: ToolCall[] = [];
    let textContent = '';

    for (const content of data.content || []) {
      if (content.type === 'text') {
        textContent += content.text;
      } else if (content.type === 'tool_use') {
        toolCalls.push({
          id: content.id,
          type: 'function',
          function: {
            name: content.name,
            arguments: JSON.stringify(content.input || {})
          }
        });
      }
    }

    message.content = textContent;
    if (toolCalls.length > 0) {
      message.toolCalls = toolCalls;
    }

    return {
      id: data.id || this.generateRequestId(),
      model: data.model || this.config.model,
      created: this.getCurrentTimestamp(),
      choices: [{
        index: 0,
        message,
        finishReason: this.mapFinishReason(data.stop_reason)
      }],
      usage: data.usage ? {
        promptTokens: data.usage.input_tokens || 0,
        completionTokens: data.usage.output_tokens || 0,
        totalTokens: (data.usage.input_tokens || 0) + (data.usage.output_tokens || 0)
      } : undefined
    };
  }

  private transformStreamingChunk(data: any): StreamingChunk | null {
    if (data.type === 'message_start') {
      return {
        id: data.message?.id || this.generateRequestId(),
        model: data.message?.model || this.config.model,
        created: this.getCurrentTimestamp(),
        choices: [{
          index: 0,
          delta: {},
          finishReason: null
        }]
      };
    }

    if (data.type === 'content_block_delta') {
      if (data.delta?.type === 'text_delta') {
        return {
          id: this.generateRequestId(),
          model: this.config.model,
          created: this.getCurrentTimestamp(),
          choices: [{
            index: 0,
            delta: { content: data.delta.text },
            finishReason: null
          }]
        };
      }
    }

    if (data.type === 'message_delta') {
      return {
        id: this.generateRequestId(),
        model: this.config.model,
        created: this.getCurrentTimestamp(),
        choices: [{
          index: 0,
          delta: {},
          finishReason: this.mapFinishReason(data.delta?.stop_reason)
        }],
        usage: data.usage ? {
          promptTokens: 0,
          completionTokens: data.usage.output_tokens || 0,
          totalTokens: data.usage.output_tokens || 0
        } : undefined
      };
    }

    return null;
  }

  private mapFinishReason(reason: string | undefined): 'stop' | 'length' | 'tool_calls' | 'content_filter' | null {
    switch (reason) {
      case 'end_turn':
        return 'stop';
      case 'max_tokens':
        return 'length';
      case 'tool_use':
        return 'tool_calls';
      case 'stop_sequence':
        return 'stop';
      default:
        return null;
    }
  }
}