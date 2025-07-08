/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { BaseAuthProvider } from './base.js';
import { AuthProvider, AuthMethod, AuthConfig, AuthResult, ApiKeyAuthConfig } from '../types.js';

/**
 * Qwen authentication provider
 */
export class QwenAuthProvider extends BaseAuthProvider {
  readonly provider = AuthProvider.QWEN;
  readonly supportedMethods = [AuthMethod.QWEN_API_KEY];

  async validateConfig(config: AuthConfig): Promise<AuthResult> {
    if (config.method !== AuthMethod.QWEN_API_KEY) {
      return {
        success: false,
        error: `Unsupported authentication method: ${config.method}`
      };
    }

    const apiKeyConfig = config as ApiKeyAuthConfig;
    
    if (!apiKeyConfig.apiKey) {
      return {
        success: false,
        error: 'API key is required for Qwen authentication'
      };
    }

    if (!apiKeyConfig.apiKey.startsWith('sk-')) {
      return {
        success: false,
        error: 'Qwen API keys should start with "sk-"'
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
      
      // Test the API key by making a simple request to DashScope
      const response = await this.makeRequest('https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKeyConfig.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'qwen-turbo',
          input: {
            messages: [
              { role: 'user', content: 'Hello' }
            ]
          },
          parameters: {
            max_tokens: 1
          }
        })
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
          error: `Qwen API key validation failed: ${response.error}`
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