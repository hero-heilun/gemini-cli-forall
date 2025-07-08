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
  OAuthAuthConfig,
  VertexAIAuthConfig
} from '../types.js';

/**
 * Google authentication provider
 */
export class GoogleAuthProvider extends BaseAuthProvider {
  readonly provider = AuthProvider.GOOGLE;
  readonly supportedMethods = [
    AuthMethod.GOOGLE_API_KEY,
    AuthMethod.GOOGLE_OAUTH,
    AuthMethod.GOOGLE_VERTEX_AI,
  ];

  async validateConfig(config: AuthConfig): Promise<AuthResult> {
    switch (config.method) {
      case AuthMethod.GOOGLE_API_KEY:
        return this.validateApiKeyConfig(config as ApiKeyAuthConfig);
      case AuthMethod.GOOGLE_OAUTH:
        return this.validateOAuthConfig(config as OAuthAuthConfig);
      case AuthMethod.GOOGLE_VERTEX_AI:
        return this.validateVertexAIConfig(config as VertexAIAuthConfig);
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
      case AuthMethod.GOOGLE_API_KEY:
        return this.authenticateWithApiKey(config as ApiKeyAuthConfig);
      case AuthMethod.GOOGLE_OAUTH:
        return this.authenticateWithOAuth(config as OAuthAuthConfig);
      case AuthMethod.GOOGLE_VERTEX_AI:
        return this.authenticateWithVertexAI(config as VertexAIAuthConfig);
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
    return this.validateRequiredProperties(config, ['apiKey']);
  }

  private validateOAuthConfig(config: OAuthAuthConfig): AuthResult {
    // For OAuth, we might need different validation based on flow
    if (!config.accessToken && !config.clientId) {
      return {
        success: false,
        error: 'OAuth requires either accessToken or clientId'
      };
    }
    return { success: true };
  }

  private validateVertexAIConfig(config: VertexAIAuthConfig): AuthResult {
    return this.validateRequiredProperties(config, ['projectId', 'location']);
  }

  private async authenticateWithApiKey(config: ApiKeyAuthConfig): Promise<AuthResult> {
    try {
      // Test the API key by making a simple request
      const testUrl = config.baseUrl || 'https://generativelanguage.googleapis.com';
      const response = await this.makeRequest(`${testUrl}/v1beta/models`, {
        headers: {
          'x-goog-api-key': config.apiKey,
        },
      });

      if (response.success) {
        return {
          success: true,
          credentials: { apiKey: config.apiKey },
          metadata: { models: response.data?.models }
        };
      } else {
        return {
          success: false,
          error: `API key validation failed: ${response.error}`
        };
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Authentication failed'
      };
    }
  }

  private async authenticateWithOAuth(config: OAuthAuthConfig): Promise<AuthResult> {
    try {
      if (config.accessToken) {
        // Validate existing access token
        const response = await this.makeRequest('https://www.googleapis.com/oauth2/v1/tokeninfo', {
          headers: {
            'Authorization': `Bearer ${config.accessToken}`,
          },
        });

        if (response.success) {
          return {
            success: true,
            credentials: { accessToken: config.accessToken },
            metadata: response.data
          };
        } else {
          return {
            success: false,
            error: `OAuth token validation failed: ${response.error}`
          };
        }
      } else {
        // TODO: Implement OAuth flow initiation
        return {
          success: false,
          error: 'OAuth flow not implemented yet'
        };
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'OAuth authentication failed'
      };
    }
  }

  private async authenticateWithVertexAI(config: VertexAIAuthConfig): Promise<AuthResult> {
    try {
      // For Vertex AI, we need to validate the project and location
      if (config.apiKey) {
        // Using API key for Vertex AI
        const testUrl = `https://${config.location}-aiplatform.googleapis.com/v1/projects/${config.projectId}/locations/${config.location}/publishers/google/models`;
        const response = await this.makeRequest(testUrl, {
          headers: {
            'Authorization': `Bearer ${config.apiKey}`,
          },
        });

        if (response.success) {
          return {
            success: true,
            credentials: { 
              projectId: config.projectId, 
              location: config.location,
              apiKey: config.apiKey 
            },
            metadata: response.data
          };
        } else {
          return {
            success: false,
            error: `Vertex AI validation failed: ${response.error}`
          };
        }
      } else {
        // Using default credentials (ADC)
        const envValidation = this.validateEnvironmentVariables(['GOOGLE_APPLICATION_CREDENTIALS']);
        if (!envValidation.success) {
          return {
            success: false,
            error: 'Vertex AI requires either API key or Application Default Credentials'
          };
        }

        return {
          success: true,
          credentials: { 
            projectId: config.projectId, 
            location: config.location 
          }
        };
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Vertex AI authentication failed'
      };
    }
  }
}