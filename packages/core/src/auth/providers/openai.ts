/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { BaseAuthProvider } from './base.js';
import { 
  AuthProvider, 
  AuthMethod, 
  AuthConfig, 
  AuthResult,
  ApiKeyAuthConfig,
  AzureAuthConfig
} from '../types.js';

/**
 * OpenAI authentication provider
 */
export class OpenAIAuthProvider extends BaseAuthProvider {
  readonly provider = AuthProvider.OPENAI;
  readonly supportedMethods = [
    AuthMethod.OPENAI_API_KEY,
    AuthMethod.OPENAI_AZURE,
  ];

  async validateConfig(config: AuthConfig): Promise<AuthResult> {
    switch (config.method) {
      case AuthMethod.OPENAI_API_KEY:
        return this.validateApiKeyConfig(config as ApiKeyAuthConfig);
      case AuthMethod.OPENAI_AZURE:
        return this.validateAzureConfig(config as AzureAuthConfig);
      default:
        return {
          success: false,
          error: `Unsupported authentication method: ${config.method}`
        };
    }
  }

  async authenticate(config: AuthConfig): Promise<AuthResult> {
    const validation = await this.validateConfig(config);
    if (!validation.success) {
      return validation;
    }

    switch (config.method) {
      case AuthMethod.OPENAI_API_KEY:
        return this.authenticateWithApiKey(config as ApiKeyAuthConfig);
      case AuthMethod.OPENAI_AZURE:
        return this.authenticateWithAzure(config as AzureAuthConfig);
      default:
        return {
          success: false,
          error: `Unsupported authentication method: ${config.method}`
        };
    }
  }

  async isValid(config: AuthConfig): Promise<boolean> {
    try {
      const result = await this.authenticate(config);
      return result.success;
    } catch {
      return false;
    }
  }

  private validateApiKeyConfig(config: ApiKeyAuthConfig): AuthResult {
    const validation = this.validateRequiredProperties(config, ['apiKey']);
    if (!validation.success) {
      return validation;
    }

    // Validate API key format
    if (!config.apiKey.startsWith('sk-')) {
      return {
        success: false,
        error: 'Invalid OpenAI API key format. Should start with "sk-"'
      };
    }

    return { success: true };
  }

  private validateAzureConfig(config: AzureAuthConfig): AuthResult {
    return this.validateRequiredProperties(config, ['apiKey', 'endpoint']);
  }

  private async authenticateWithApiKey(config: ApiKeyAuthConfig): Promise<AuthResult> {
    try {
      // Test the API key by making a request to list models
      const baseUrl = config.baseUrl || 'https://api.openai.com';
      const response = await this.makeRequest(`${baseUrl}/v1/models`, {
        headers: {
          'Authorization': `Bearer ${config.apiKey}`,
        },
      });

      if (response.success) {
        return {
          success: true,
          credentials: { apiKey: config.apiKey },
          metadata: { 
            baseUrl,
            models: response.data?.data 
          }
        };
      } else {
        // Check if it's an authentication error specifically
        if (response.error?.includes('401') || response.error?.includes('Unauthorized')) {
          return {
            success: false,
            error: 'Invalid OpenAI API key'
          };
        } else {
          return {
            success: false,
            error: `API validation failed: ${response.error}`
          };
        }
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Authentication failed'
      };
    }
  }

  private async authenticateWithAzure(config: AzureAuthConfig): Promise<AuthResult> {
    try {
      // Test Azure OpenAI authentication
      const apiVersion = config.apiVersion || '2023-12-01-preview';
      const url = `${config.endpoint}/openai/deployments?api-version=${apiVersion}`;
      
      const response = await this.makeRequest(url, {
        headers: {
          'api-key': config.apiKey,
        },
      });

      if (response.success) {
        return {
          success: true,
          credentials: { 
            apiKey: config.apiKey,
            endpoint: config.endpoint,
            apiVersion
          },
          metadata: { 
            deployments: response.data?.data,
            endpoint: config.endpoint
          }
        };
      } else {
        if (response.error?.includes('401') || response.error?.includes('403')) {
          return {
            success: false,
            error: 'Invalid Azure OpenAI credentials'
          };
        } else {
          return {
            success: false,
            error: `Azure API validation failed: ${response.error}`
          };
        }
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Azure authentication failed'
      };
    }
  }
}