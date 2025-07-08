/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import { AuthConfig } from '../auth/types.js';

/**
 * Supported model providers
 */
export enum ModelProvider {
  GOOGLE_GEMINI = 'google-gemini',
  ANTHROPIC_CLAUDE = 'anthropic-claude',
  OPENAI_GPT = 'openai-gpt',
  AZURE_OPENAI = 'azure-openai',
  DEEPSEEK = 'deepseek',
  QWEN = 'qwen',
  CUSTOM = 'custom',
}

/**
 * Model capabilities
 */
export interface ModelCapabilities {
  textGeneration: boolean;
  streaming: boolean;
  functionCalling: boolean;
  multimodal: boolean;
  embedding: boolean;
  tokenCounting: boolean;
  maxTokens?: number;
  maxContextLength?: number;
  supportedMimeTypes?: string[];
}

/**
 * Model configuration
 */
export interface ModelConfig {
  provider: ModelProvider;
  model: string;
  displayName?: string;
  capabilities: ModelCapabilities;
  baseUrl?: string;
  apiVersion?: string;
  deployment?: string;
  defaultParameters?: Record<string, any>;
}

/**
 * Generation parameters
 */
export interface GenerationParameters {
  model?: string;
  maxTokens?: number;
  temperature?: number;
  topP?: number;
  topK?: number;
  stopSequences?: string[];
  frequencyPenalty?: number;
  presencePenalty?: number;
  stream?: boolean;
  tools?: any[];
  systemPrompt?: string;
  [key: string]: any;
}

/**
 * Message content part
 */
export interface ContentPart {
  type: 'text' | 'image' | 'audio' | 'video' | 'document';
  text?: string;
  imageUrl?: string;
  mimeType?: string;
  data?: string | ArrayBuffer;
}

/**
 * Chat message
 */
export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | ContentPart[];
  name?: string;
  toolCallId?: string;
  toolCalls?: ToolCall[];
}

/**
 * Tool call representation
 */
export interface ToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

/**
 * Tool definition
 */
export interface ToolDefinition {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: any; // JSON Schema
  };
}

/**
 * Generation request
 */
export interface GenerationRequest {
  messages: ChatMessage[];
  parameters?: GenerationParameters;
  tools?: ToolDefinition[];
  toolChoice?: 'auto' | 'none' | { type: 'function'; function: { name: string } };
}

/**
 * Generation response
 */
export interface GenerationResponse {
  id: string;
  model: string;
  created: number;
  choices: Array<{
    index: number;
    message: ChatMessage;
    finishReason: 'stop' | 'length' | 'tool_calls' | 'content_filter' | null;
  }>;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  metadata?: Record<string, any>;
}

/**
 * Streaming response chunk
 */
export interface StreamingChunk {
  id: string;
  model: string;
  created: number;
  choices: Array<{
    index: number;
    delta: Partial<ChatMessage>;
    finishReason: 'stop' | 'length' | 'tool_calls' | 'content_filter' | null;
  }>;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

/**
 * Token counting request
 */
export interface TokenCountRequest {
  messages: ChatMessage[];
  model?: string;
  tools?: ToolDefinition[];
}

/**
 * Token counting response
 */
export interface TokenCountResponse {
  totalTokens: number;
  promptTokens?: number;
  metadata?: Record<string, any>;
}

/**
 * Embedding request
 */
export interface EmbeddingRequest {
  input: string | string[];
  model?: string;
  dimensions?: number;
}

/**
 * Embedding response
 */
export interface EmbeddingResponse {
  data: Array<{
    object: 'embedding';
    embedding: number[];
    index: number;
  }>;
  model: string;
  usage: {
    promptTokens: number;
    totalTokens: number;
  };
}

/**
 * Model client interface
 */
export interface IModelClient {
  readonly provider: ModelProvider;
  readonly config: ModelConfig;
  readonly authConfig: AuthConfig;
  
  /**
   * Generate content
   */
  generateContent(request: GenerationRequest): Promise<GenerationResponse>;
  
  /**
   * Generate content with streaming
   */
  generateContentStream(request: GenerationRequest): AsyncGenerator<StreamingChunk>;
  
  /**
   * Count tokens
   */
  countTokens(request: TokenCountRequest): Promise<TokenCountResponse>;
  
  /**
   * Generate embeddings
   */
  generateEmbeddings?(request: EmbeddingRequest): Promise<EmbeddingResponse>;
  
  /**
   * Get available models
   */
  listModels?(): Promise<ModelConfig[]>;
  
  /**
   * Validate model and authentication
   */
  validate(): Promise<boolean>;
}