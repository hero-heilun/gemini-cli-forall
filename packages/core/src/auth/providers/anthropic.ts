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
  ApiKeyAuthConfig
} from '../types.js';

/**
 * Anthropic authentication provider
 */
export class AnthropicAuthProvider extends BaseAuthProvider {
  readonly provider = AuthProvider.ANTHROPIC;
  readonly supportedMethods = [AuthMethod.ANTHROPIC_API_KEY];

  async validateConfig(config: AuthConfig): Promise<AuthResult> {
    if (config.method !== AuthMethod.ANTHROPIC_API_KEY) {
      return {
        success: false,
        error: `Unsupported authentication method: ${config.method}`
      };
    }

    return this.validateApiKeyConfig(config as ApiKeyAuthConfig);
  }

  async authenticate(config: AuthConfig): Promise<AuthResult> {
    const validation = await this.validateConfig(config);
    if (!validation.success) {
      return validation;
    }

    return this.authenticateWithApiKey(config as ApiKeyAuthConfig);
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
    if (!config.apiKey.startsWith('sk-ant-')) {
      return {
        success: false,
        error: 'Invalid Anthropic API key format. Should start with "sk-ant-"'
      };
    }

    return { success: true };
  }

  private async authenticateWithApiKey(config: ApiKeyAuthConfig): Promise<AuthResult> {
    try {
      // Test the API key by making a request to list models or get user info
      const baseUrl = config.baseUrl || 'https://api.anthropic.com';
      const response = await this.makeRequest(`${baseUrl}/v1/messages`, {
        method: 'POST',
        headers: {
          'x-api-key': config.apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-3-haiku-20240307',
          max_tokens: 1,
          messages: [
            {
              role: 'user',
              content: 'Hello'
            }
          ]
        })
      });

      if (response.success) {
        return {
          success: true,
          credentials: { apiKey: config.apiKey },
          metadata: { 
            baseUrl,
            version: '2023-06-01'
          }
        };
      } else {
        // Check if it's an authentication error specifically
        if (response.error?.includes('401') || response.error?.includes('authentication')) {
          return {
            success: false,
            error: 'Invalid Anthropic API key'
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
}