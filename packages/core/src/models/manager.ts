/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  IModelClient,
  ModelProvider,
  ModelConfig,
  ModelCapabilities,
  GenerationRequest,
  GenerationResponse,
  StreamingChunk,
  TokenCountRequest,
  TokenCountResponse
} from './types.js';
import { AuthConfig } from '../auth/types.js';
import { GoogleModelClient } from './clients/google.js';
import { AnthropicModelClient } from './clients/anthropic.js';
import { DeepSeekModelClient } from './clients/deepseek.js';
import { QwenModelClient } from './clients/qwen.js';

/**
 * Model configuration registry
 */
export class ModelManager {
  private models: Map<string, ModelConfig> = new Map();
  private clients: Map<string, IModelClient> = new Map();

  constructor() {
    this.registerDefaultModels();
  }

  /**
   * Register default model configurations
   */
  private registerDefaultModels(): void {
    // Google Gemini models
    this.registerModel({
      provider: ModelProvider.GOOGLE_GEMINI,
      model: 'gemini-2.5-flash',
      displayName: 'Gemini 2.5 Flash',
      capabilities: {
        textGeneration: true,
        streaming: true,
        functionCalling: true,
        multimodal: true,
        embedding: false,
        tokenCounting: true,
        maxTokens: 8192,
        maxContextLength: 1000000,
        supportedMimeTypes: ['image/jpeg', 'image/png', 'image/webp']
      }
    });

    this.registerModel({
      provider: ModelProvider.GOOGLE_GEMINI,
      model: 'gemini-2.5-pro',
      displayName: 'Gemini 2.5 Pro',
      capabilities: {
        textGeneration: true,
        streaming: true,
        functionCalling: true,
        multimodal: true,
        embedding: false,
        tokenCounting: true,
        maxTokens: 8192,
        maxContextLength: 2000000,
        supportedMimeTypes: ['image/jpeg', 'image/png', 'image/webp']
      }
    });

    // Anthropic Claude models
    this.registerModel({
      provider: ModelProvider.ANTHROPIC_CLAUDE,
      model: 'claude-3-5-sonnet-20241022',
      displayName: 'Claude 3.5 Sonnet',
      capabilities: {
        textGeneration: true,
        streaming: true,
        functionCalling: true,
        multimodal: true,
        embedding: false,
        tokenCounting: false,
        maxTokens: 8192,
        maxContextLength: 200000,
        supportedMimeTypes: ['image/jpeg', 'image/png', 'image/webp']
      }
    });

    this.registerModel({
      provider: ModelProvider.ANTHROPIC_CLAUDE,
      model: 'claude-3-5-haiku-20241022',
      displayName: 'Claude 3.5 Haiku',
      capabilities: {
        textGeneration: true,
        streaming: true,
        functionCalling: true,
        multimodal: true,
        embedding: false,
        tokenCounting: false,
        maxTokens: 8192,
        maxContextLength: 200000,
        supportedMimeTypes: ['image/jpeg', 'image/png', 'image/webp']
      }
    });

    this.registerModel({
      provider: ModelProvider.ANTHROPIC_CLAUDE,
      model: 'claude-3-opus-20240229',
      displayName: 'Claude 3 Opus',
      capabilities: {
        textGeneration: true,
        streaming: true,
        functionCalling: true,
        multimodal: true,
        embedding: false,
        tokenCounting: false,
        maxTokens: 4096,
        maxContextLength: 200000,
        supportedMimeTypes: ['image/jpeg', 'image/png', 'image/webp']
      }
    });

    // OpenAI GPT models
    this.registerModel({
      provider: ModelProvider.OPENAI_GPT,
      model: 'gpt-4',
      displayName: 'GPT-4',
      capabilities: {
        textGeneration: true,
        streaming: true,
        functionCalling: true,
        multimodal: false,
        embedding: false,
        tokenCounting: false,
        maxTokens: 4096,
        maxContextLength: 8192,
        supportedMimeTypes: []
      }
    });

    this.registerModel({
      provider: ModelProvider.OPENAI_GPT,
      model: 'gpt-4-turbo',
      displayName: 'GPT-4 Turbo',
      capabilities: {
        textGeneration: true,
        streaming: true,
        functionCalling: true,
        multimodal: true,
        embedding: false,
        tokenCounting: false,
        maxTokens: 4096,
        maxContextLength: 128000,
        supportedMimeTypes: ['image/jpeg', 'image/png', 'image/webp']
      }
    });

    this.registerModel({
      provider: ModelProvider.OPENAI_GPT,
      model: 'gpt-3.5-turbo',
      displayName: 'GPT-3.5 Turbo',
      capabilities: {
        textGeneration: true,
        streaming: true,
        functionCalling: true,
        multimodal: false,
        embedding: false,
        tokenCounting: false,
        maxTokens: 4096,
        maxContextLength: 16385,
        supportedMimeTypes: []
      }
    });

    // DeepSeek models
    this.registerModel({
      provider: ModelProvider.DEEPSEEK,
      model: 'deepseek-chat',
      displayName: 'DeepSeek Chat',
      capabilities: {
        textGeneration: true,
        streaming: true,
        functionCalling: true,
        multimodal: false,
        embedding: false,
        tokenCounting: false,
        maxTokens: 4096,
        maxContextLength: 32768,
        supportedMimeTypes: []
      }
    });

    this.registerModel({
      provider: ModelProvider.DEEPSEEK,
      model: 'deepseek-coder',
      displayName: 'DeepSeek Coder',
      capabilities: {
        textGeneration: true,
        streaming: true,
        functionCalling: true,
        multimodal: false,
        embedding: false,
        tokenCounting: false,
        maxTokens: 4096,
        maxContextLength: 16384,
        supportedMimeTypes: []
      }
    });

    this.registerModel({
      provider: ModelProvider.DEEPSEEK,
      model: 'deepseek-v3',
      displayName: 'DeepSeek V3',
      capabilities: {
        textGeneration: true,
        streaming: true,
        functionCalling: true,
        multimodal: false,
        embedding: false,
        tokenCounting: false,
        maxTokens: 8192,
        maxContextLength: 64000,
        supportedMimeTypes: []
      }
    });

    // Qwen models
    this.registerModel({
      provider: ModelProvider.QWEN,
      model: 'qwen-turbo',
      displayName: 'Qwen Turbo',
      capabilities: {
        textGeneration: true,
        streaming: true,
        functionCalling: true,
        multimodal: false,
        embedding: false,
        tokenCounting: false,
        maxTokens: 1500,
        maxContextLength: 6000,
        supportedMimeTypes: []
      }
    });

    this.registerModel({
      provider: ModelProvider.QWEN,
      model: 'qwen-plus',
      displayName: 'Qwen Plus',
      capabilities: {
        textGeneration: true,
        streaming: true,
        functionCalling: true,
        multimodal: false,
        embedding: false,
        tokenCounting: false,
        maxTokens: 2000,
        maxContextLength: 32000,
        supportedMimeTypes: []
      }
    });

    this.registerModel({
      provider: ModelProvider.QWEN,
      model: 'qwen-max',
      displayName: 'Qwen Max',
      capabilities: {
        textGeneration: true,
        streaming: true,
        functionCalling: true,
        multimodal: false,
        embedding: false,
        tokenCounting: false,
        maxTokens: 2000,
        maxContextLength: 8000,
        supportedMimeTypes: []
      }
    });

    this.registerModel({
      provider: ModelProvider.QWEN,
      model: 'qwen2.5-coder-32b-instruct',
      displayName: 'Qwen2.5-Coder 32B',
      capabilities: {
        textGeneration: true,
        streaming: true,
        functionCalling: true,
        multimodal: false,
        embedding: false,
        tokenCounting: false,
        maxTokens: 8192,
        maxContextLength: 131072,
        supportedMimeTypes: []
      }
    });

    this.registerModel({
      provider: ModelProvider.QWEN,
      model: 'qwen2.5-coder-7b-instruct',
      displayName: 'Qwen2.5-Coder 7B',
      capabilities: {
        textGeneration: true,
        streaming: true,
        functionCalling: true,
        multimodal: false,
        embedding: false,
        tokenCounting: false,
        maxTokens: 8192,
        maxContextLength: 131072,
        supportedMimeTypes: []
      }
    });
  }

  /**
   * Register a new model configuration
   */
  registerModel(config: ModelConfig): void {
    this.models.set(config.model, config);
  }

  /**
   * Get model configuration by name
   */
  getModel(modelName: string): ModelConfig | undefined {
    return this.models.get(modelName);
  }

  /**
   * Get all registered models
   */
  getModels(): ModelConfig[] {
    return Array.from(this.models.values());
  }

  /**
   * Get models by provider
   */
  getModelsByProvider(provider: ModelProvider): ModelConfig[] {
    return Array.from(this.models.values()).filter(model => model.provider === provider);
  }

  /**
   * Get available models for a provider based on authentication
   */
  getAvailableModels(authConfig: AuthConfig): ModelConfig[] {
    const providerMap: Record<string, ModelProvider> = {
      'google': ModelProvider.GOOGLE_GEMINI,
      'anthropic': ModelProvider.ANTHROPIC_CLAUDE,
      'openai': ModelProvider.OPENAI_GPT,
      'azure': ModelProvider.AZURE_OPENAI,
      'deepseek': ModelProvider.DEEPSEEK,
      'qwen': ModelProvider.QWEN,
    };

    const provider = providerMap[authConfig.provider];
    if (!provider) {
      return [];
    }

    return this.getModelsByProvider(provider);
  }


  /**
   * Create a model client
   */
  async createClient(modelName: string, authConfig: AuthConfig): Promise<IModelClient> {
    const clientKey = `${modelName}-${authConfig.provider}-${authConfig.method}`;
    
    // Return cached client if available
    if (this.clients.has(clientKey)) {
      return this.clients.get(clientKey)!;
    }

    const modelConfig = this.getModel(modelName);
    if (!modelConfig) {
      throw new Error(`Unknown model: ${modelName}`);
    }

    let client: IModelClient;

    switch (modelConfig.provider) {
      case ModelProvider.GOOGLE_GEMINI:
        client = new GoogleModelClient(modelConfig, authConfig);
        break;
      case ModelProvider.ANTHROPIC_CLAUDE:
        client = new AnthropicModelClient(modelConfig, authConfig);
        break;
      case ModelProvider.DEEPSEEK:
        client = new DeepSeekModelClient(modelConfig, authConfig);
        break;
      case ModelProvider.QWEN:
        client = new QwenModelClient(modelConfig, authConfig);
        break;
      default:
        throw new Error(`Unsupported model provider: ${modelConfig.provider}`);
    }

    // Validate the client
    const isValid = await client.validate();
    if (!isValid) {
      throw new Error(`Failed to validate model client for ${modelName}`);
    }

    // Cache the client
    this.clients.set(clientKey, client);
    return client;
  }

  /**
   * Generate content using a model
   */
  async generateContent(
    modelName: string, 
    authConfig: AuthConfig, 
    request: GenerationRequest
  ): Promise<GenerationResponse> {
    const client = await this.createClient(modelName, authConfig);
    return client.generateContent(request);
  }

  /**
   * Generate content with streaming using a model
   */
  async* generateContentStream(
    modelName: string, 
    authConfig: AuthConfig, 
    request: GenerationRequest
  ): AsyncGenerator<StreamingChunk> {
    const client = await this.createClient(modelName, authConfig);
    yield* client.generateContentStream(request);
  }

  /**
   * Count tokens using a model
   */
  async countTokens(
    modelName: string, 
    authConfig: AuthConfig, 
    request: TokenCountRequest
  ): Promise<TokenCountResponse> {
    const client = await this.createClient(modelName, authConfig);
    return client.countTokens(request);
  }

  /**
   * Check if a model supports a capability
   */
  hasCapability(modelName: string, capability: keyof ModelCapabilities): boolean {
    const model = this.getModel(modelName);
    return model?.capabilities[capability] === true;
  }

  /**
   * Get the maximum tokens for a model
   */
  getMaxTokens(modelName: string): number | undefined {
    const model = this.getModel(modelName);
    return model?.capabilities.maxTokens;
  }

  /**
   * Get the maximum context length for a model
   */
  getMaxContextLength(modelName: string): number | undefined {
    const model = this.getModel(modelName);
    return model?.capabilities.maxContextLength;
  }

  /**
   * Check if a model supports multimodal input
   */
  isMultimodal(modelName: string): boolean {
    return this.hasCapability(modelName, 'multimodal');
  }

  /**
   * Check if a model supports function calling
   */
  supportsFunctionCalling(modelName: string): boolean {
    return this.hasCapability(modelName, 'functionCalling');
  }

  /**
   * Check if a model supports streaming
   */
  supportsStreaming(modelName: string): boolean {
    return this.hasCapability(modelName, 'streaming');
  }

  /**
   * Get supported MIME types for a model
   */
  getSupportedMimeTypes(modelName: string): string[] {
    const model = this.getModel(modelName);
    return model?.capabilities.supportedMimeTypes || [];
  }

  /**
   * Clear cached clients
   */
  clearClientCache(): void {
    this.clients.clear();
  }

  /**
   * Get client cache stats
   */
  getClientCacheStats(): { total: number; keys: string[] } {
    return {
      total: this.clients.size,
      keys: Array.from(this.clients.keys())
    };
  }
}