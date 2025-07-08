/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { BaseAuthProvider } from './base.js';
import { AuthProvider, AuthMethod, AuthConfig, AuthResult, ApiKeyAuthConfig } from '../types.js';

/**
 * DeepSeek authentication provider
 */
export class DeepSeekAuthProvider extends BaseAuthProvider {
  readonly provider = AuthProvider.DEEPSEEK;
  readonly supportedMethods = [AuthMethod.DEEPSEEK_API_KEY];

  async validateConfig(config: AuthConfig): Promise<AuthResult> {
    if (config.method !== AuthMethod.DEEPSEEK_API_KEY) {
      return {
        success: false,
        error: `Unsupported authentication method: ${config.method}`
      };
    }

    const apiKeyConfig = config as ApiKeyAuthConfig;
    
    if (!apiKeyConfig.apiKey) {
      return {
        success: false,
        error: 'API key is required for DeepSeek authentication'
      };
    }

    if (!apiKeyConfig.apiKey.startsWith('sk-')) {
      return {
        success: false,
        error: 'DeepSeek API keys should start with "sk-"'
      };
    }

    return { success: true };
  }

  async authenticate(config: AuthConfig): Promise<AuthResult> {
    const validation = await this.validateConfig(config);
    if (!validation.success) {
      return validation;
    }

    try {
      const apiKeyConfig = config as ApiKeyAuthConfig;
      
      // Test the API key by making a simple request to DeepSeek
      const response = await this.makeRequest('https://api.deepseek.com/v1/models', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${apiKeyConfig.apiKey}`,
          'Content-Type': 'application/json',
        }
      });

      if (response.success) {
        return {
          success: true,
          credentials: { apiKey: apiKeyConfig.apiKey },
          metadata: response.data
        };
      } else {
        return {
          success: false,
          error: `DeepSeek API key validation failed: ${response.error}`
        };
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Authentication failed'
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
}