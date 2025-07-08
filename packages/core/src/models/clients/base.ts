/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import { 
  IModelClient,
  ModelProvider,
  ModelConfig,
  GenerationRequest,
  GenerationResponse,
  StreamingChunk,
  TokenCountRequest,
  TokenCountResponse,
  EmbeddingRequest,
  EmbeddingResponse,
  ContentPart
} from '../types.js';
import { AuthConfig } from '../../auth/types.js';

/**
 * Base model client with common functionality
 */
export abstract class BaseModelClient implements IModelClient {
  abstract readonly provider: ModelProvider;
  
  constructor(
    readonly config: ModelConfig,
    readonly authConfig: AuthConfig
  ) {}

  /**
   * Generate content
   */
  abstract generateContent(request: GenerationRequest): Promise<GenerationResponse>;

  /**
   * Generate content with streaming
   */
  abstract generateContentStream(request: GenerationRequest): AsyncGenerator<StreamingChunk>;

  /**
   * Count tokens
   */
  abstract countTokens(request: TokenCountRequest): Promise<TokenCountResponse>;

  /**
   * Generate embeddings (optional)
   */
  async generateEmbeddings(_request: EmbeddingRequest): Promise<EmbeddingResponse> {
    throw new Error(`Embeddings not supported by ${this.provider}`);
  }

  /**
   * Get available models (optional)
   */
  async listModels(): Promise<ModelConfig[]> {
    throw new Error(`Model listing not supported by ${this.provider}`);
  }

  /**
   * Validate model and authentication
   */
  abstract validate(): Promise<boolean>;

  /**
   * Helper method to make HTTP requests
   */
  protected async makeRequest(
    url: string,
    options: RequestInit = {}
  ): Promise<{ success: boolean; data?: any; error?: string; response?: Response }> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);
      
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
      });
      
      clearTimeout(timeoutId);

      if (!response.ok) {
        let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
        try {
          const errorData = await response.json();
          if (errorData.error?.message) {
            errorMessage = errorData.error.message;
          } else if (errorData.message) {
            errorMessage = errorData.message;
          }
        } catch {
          // Ignore JSON parsing errors for error responses
        }
        
        return {
          success: false,
          error: errorMessage,
          response
        };
      }

      const data = await response.json();
      return { success: true, data, response };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Helper method to make streaming requests
   */
  protected async* makeStreamingRequest(
    url: string,
    options: RequestInit = {}
  ): AsyncGenerator<{ success: boolean; data?: any; error?: string; done?: boolean }> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);
      
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
      });
      
      clearTimeout(timeoutId);

      if (!response.ok) {
        yield {
          success: false,
          error: `HTTP ${response.status}: ${response.statusText}`
        };
        return;
      }

      const reader = response.body?.getReader();
      if (!reader) {
        yield {
          success: false,
          error: 'No response body available'
        };
        return;
      }

      const decoder = new TextDecoder();
      let buffer = '';

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed === '' || trimmed === 'data: [DONE]') continue;
            
            if (trimmed.startsWith('data: ')) {
              try {
                const data = JSON.parse(trimmed.slice(6));
                yield { success: true, data };
              } catch (error) {
                yield {
                  success: false,
                  error: `JSON parse error: ${error instanceof Error ? error.message : 'Unknown error'}`
                };
              }
            }
          }
        }

        yield { success: true, done: true };
      } finally {
        reader.releaseLock();
      }
    } catch (error) {
      yield {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Helper method to normalize message content
   */
  protected normalizeMessageContent(content: string | ContentPart[]): string {
    if (typeof content === 'string') {
      return content;
    }
    
    return content
      .filter(part => part.type === 'text' && part.text)
      .map(part => part.text!)
      .join('\n');
  }

  /**
   * Helper method to extract text from message content
   */
  protected extractTextFromContent(content: string | ContentPart[]): string {
    if (typeof content === 'string') {
      return content;
    }

    const textParts = content.filter(part => part.type === 'text' && part.text);
    return textParts.map(part => part.text!).join('\n');
  }

  /**
   * Helper method to check if content has non-text parts
   */
  protected hasMultimodalContent(content: string | ContentPart[]): boolean {
    if (typeof content === 'string') {
      return false;
    }
    
    return content.some(part => part.type !== 'text');
  }

  /**
   * Generate unique request ID
   */
  protected generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get current timestamp
   */
  protected getCurrentTimestamp(): number {
    return Math.floor(Date.now() / 1000);
  }
}