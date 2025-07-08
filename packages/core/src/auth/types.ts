/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Supported authentication providers
 */
export enum AuthProvider {
  GOOGLE = 'google',
  ANTHROPIC = 'anthropic',
  OPENAI = 'openai',
  AZURE = 'azure',
  DEEPSEEK = 'deepseek',
  QWEN = 'qwen',
  CUSTOM = 'custom',
}

/**
 * Authentication methods for each provider
 */
export enum AuthMethod {
  // Google methods
  GOOGLE_OAUTH = 'google-oauth',
  GOOGLE_API_KEY = 'google-api-key',
  GOOGLE_VERTEX_AI = 'google-vertex-ai',
  
  // Anthropic methods
  ANTHROPIC_API_KEY = 'anthropic-api-key',
  
  // OpenAI methods
  OPENAI_API_KEY = 'openai-api-key',
  OPENAI_AZURE = 'openai-azure',
  
  // DeepSeek methods
  DEEPSEEK_API_KEY = 'deepseek-api-key',
  
  // Qwen methods
  QWEN_API_KEY = 'qwen-api-key',
  
  // Custom methods
  CUSTOM_API_KEY = 'custom-api-key',
  CUSTOM_OAUTH = 'custom-oauth',
}

/**
 * Base authentication configuration
 */
export interface BaseAuthConfig {
  provider: AuthProvider;
  method: AuthMethod;
}

/**
 * API Key based authentication
 */
export interface ApiKeyAuthConfig extends BaseAuthConfig {
  apiKey: string;
  baseUrl?: string;
}

/**
 * OAuth based authentication
 */
export interface OAuthAuthConfig extends BaseAuthConfig {
  clientId?: string;
  clientSecret?: string;
  scopes?: string[];
  redirectUri?: string;
  accessToken?: string;
  refreshToken?: string;
}

/**
 * Azure specific configuration
 */
export interface AzureAuthConfig extends BaseAuthConfig {
  apiKey: string;
  endpoint: string;
  apiVersion?: string;
  deployment?: string;
}

/**
 * Google Vertex AI specific configuration
 */
export interface VertexAIAuthConfig extends BaseAuthConfig {
  projectId: string;
  location: string;
  apiKey?: string;
}

/**
 * Custom authentication configuration
 */
export interface CustomAuthConfig extends BaseAuthConfig {
  baseUrl: string;
  headers?: Record<string, string>;
  authHeader?: string;
  credentials?: Record<string, any>;
}

/**
 * Union type for all authentication configurations
 */
export type AuthConfig = 
  | ApiKeyAuthConfig 
  | OAuthAuthConfig 
  | AzureAuthConfig 
  | VertexAIAuthConfig 
  | CustomAuthConfig;

/**
 * Authentication result
 */
export interface AuthResult {
  success: boolean;
  error?: string;
  credentials?: any;
  metadata?: Record<string, any>;
}

/**
 * Authentication provider interface
 */
export interface IAuthProvider {
  readonly provider: AuthProvider;
  readonly supportedMethods: AuthMethod[];
  
  /**
   * Validate authentication configuration
   */
  validateConfig(config: AuthConfig): Promise<AuthResult>;
  
  /**
   * Authenticate using the provided configuration
   */
  authenticate(config: AuthConfig): Promise<AuthResult>;
  
  /**
   * Refresh authentication if supported
   */
  refresh?(config: AuthConfig): Promise<AuthResult>;
  
  /**
   * Check if authentication is still valid
   */
  isValid(config: AuthConfig): Promise<boolean>;
}