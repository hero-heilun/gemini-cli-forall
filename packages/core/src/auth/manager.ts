/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { 
  IAuthProvider, 
  AuthProvider, 
  AuthMethod, 
  AuthConfig, 
  AuthResult 
} from './types.js';
import { GoogleAuthProvider } from './providers/google.js';
import { AnthropicAuthProvider } from './providers/anthropic.js';
import { OpenAIAuthProvider } from './providers/openai.js';
import { DeepSeekAuthProvider } from './providers/deepseek.js';
import { QwenAuthProvider } from './providers/qwen.js';

/**
 * Authentication manager that handles multiple providers
 */
export class AuthManager {
  private providers: Map<AuthProvider, IAuthProvider> = new Map();

  constructor() {
    this.registerDefaultProviders();
  }

  /**
   * Register default authentication providers
   */
  private registerDefaultProviders(): void {
    this.registerProvider(new GoogleAuthProvider());
    this.registerProvider(new AnthropicAuthProvider());
    this.registerProvider(new OpenAIAuthProvider());
    this.registerProvider(new DeepSeekAuthProvider());
    this.registerProvider(new QwenAuthProvider());
  }

  /**
   * Register a new authentication provider
   */
  registerProvider(provider: IAuthProvider): void {
    this.providers.set(provider.provider, provider);
  }

  /**
   * Get an authentication provider by name
   */
  getProvider(provider: AuthProvider): IAuthProvider | undefined {
    return this.providers.get(provider);
  }

  /**
   * Get all registered providers
   */
  getProviders(): IAuthProvider[] {
    return Array.from(this.providers.values());
  }

  /**
   * Get supported authentication methods for a provider
   */
  getSupportedMethods(provider: AuthProvider): AuthMethod[] {
    const authProvider = this.getProvider(provider);
    return authProvider?.supportedMethods || [];
  }

  /**
   * Validate authentication configuration
   */
  async validateConfig(config: AuthConfig): Promise<AuthResult> {
    const provider = this.getProvider(config.provider);
    if (!provider) {
      return {
        success: false,
        error: `Unsupported authentication provider: ${config.provider}`
      };
    }

    if (!provider.supportedMethods.includes(config.method)) {
      return {
        success: false,
        error: `Provider ${config.provider} does not support method ${config.method}`
      };
    }

    return provider.validateConfig(config);
  }

  /**
   * Authenticate using the provided configuration
   */
  async authenticate(config: AuthConfig): Promise<AuthResult> {
    const provider = this.getProvider(config.provider);
    if (!provider) {
      return {
        success: false,
        error: `Unsupported authentication provider: ${config.provider}`
      };
    }

    return provider.authenticate(config);
  }

  /**
   * Refresh authentication if supported
   */
  async refresh(config: AuthConfig): Promise<AuthResult> {
    const provider = this.getProvider(config.provider);
    if (!provider) {
      return {
        success: false,
        error: `Unsupported authentication provider: ${config.provider}`
      };
    }

    if (provider.refresh) {
      return provider.refresh(config);
    } else {
      // Fallback to re-authentication
      return provider.authenticate(config);
    }
  }

  /**
   * Check if authentication is still valid
   */
  async isValid(config: AuthConfig): Promise<boolean> {
    const provider = this.getProvider(config.provider);
    if (!provider) {
      return false;
    }

    return provider.isValid(config);
  }

  /**
   * Create authentication configuration from environment variables
   */
  static createConfigFromEnvironment(): AuthConfig | null {
    // Check for Google/Gemini
    if (process.env.GEMINI_API_KEY) {
      return {
        provider: AuthProvider.GOOGLE,
        method: AuthMethod.GOOGLE_API_KEY,
        apiKey: process.env.GEMINI_API_KEY,
      };
    }

    if (process.env.GOOGLE_API_KEY) {
      return {
        provider: AuthProvider.GOOGLE,
        method: AuthMethod.GOOGLE_API_KEY,
        apiKey: process.env.GOOGLE_API_KEY,
      };
    }

    if (process.env.GOOGLE_CLOUD_PROJECT && process.env.GOOGLE_CLOUD_LOCATION) {
      return {
        provider: AuthProvider.GOOGLE,
        method: AuthMethod.GOOGLE_VERTEX_AI,
        projectId: process.env.GOOGLE_CLOUD_PROJECT,
        location: process.env.GOOGLE_CLOUD_LOCATION,
        apiKey: process.env.GOOGLE_API_KEY,
      };
    }

    // Check for Anthropic
    if (process.env.ANTHROPIC_API_KEY) {
      return {
        provider: AuthProvider.ANTHROPIC,
        method: AuthMethod.ANTHROPIC_API_KEY,
        apiKey: process.env.ANTHROPIC_API_KEY,
      };
    }

    // Check for OpenAI
    if (process.env.OPENAI_API_KEY) {
      return {
        provider: AuthProvider.OPENAI,
        method: AuthMethod.OPENAI_API_KEY,
        apiKey: process.env.OPENAI_API_KEY,
      };
    }

    // Check for Azure OpenAI
    if (process.env.AZURE_OPENAI_API_KEY && process.env.AZURE_OPENAI_ENDPOINT) {
      return {
        provider: AuthProvider.OPENAI,
        method: AuthMethod.OPENAI_AZURE,
        apiKey: process.env.AZURE_OPENAI_API_KEY,
        endpoint: process.env.AZURE_OPENAI_ENDPOINT,
        apiVersion: process.env.AZURE_OPENAI_API_VERSION,
        deployment: process.env.AZURE_OPENAI_DEPLOYMENT,
      };
    }

    // Check for DeepSeek
    if (process.env.DEEPSEEK_API_KEY) {
      return {
        provider: AuthProvider.DEEPSEEK,
        method: AuthMethod.DEEPSEEK_API_KEY,
        apiKey: process.env.DEEPSEEK_API_KEY,
      };
    }

    return null;
  }

  /**
   * Get human-readable authentication status
   */
  async getAuthStatus(config: AuthConfig): Promise<string> {
    try {
      const isValid = await this.isValid(config);
      const provider = this.getProvider(config.provider);
      
      if (isValid) {
        return `✅ Authenticated with ${provider?.provider || 'unknown'} using ${config.method}`;
      } else {
        return `❌ Authentication failed for ${provider?.provider || 'unknown'} using ${config.method}`;
      }
    } catch (error) {
      return `❌ Error checking authentication: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
  }
}