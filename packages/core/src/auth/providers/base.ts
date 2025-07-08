/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import { 
  IAuthProvider, 
  AuthProvider, 
  AuthMethod, 
  AuthConfig, 
  AuthResult 
} from '../types.js';

/**
 * Base authentication provider with common functionality
 */
export abstract class BaseAuthProvider implements IAuthProvider {
  abstract readonly provider: AuthProvider;
  abstract readonly supportedMethods: AuthMethod[];

  /**
   * Validate authentication configuration
   */
  abstract validateConfig(config: AuthConfig): Promise<AuthResult>;

  /**
   * Authenticate using the provided configuration
   */
  abstract authenticate(config: AuthConfig): Promise<AuthResult>;

  /**
   * Check if authentication is still valid
   */
  abstract isValid(config: AuthConfig): Promise<boolean>;

  /**
   * Refresh authentication if supported
   */
  async refresh(config: AuthConfig): Promise<AuthResult> {
    // Default implementation - re-authenticate
    return this.authenticate(config);
  }

  /**
   * Helper method to validate required environment variables
   */
  protected validateEnvironmentVariables(required: string[]): AuthResult {
    const missing = required.filter(key => !process.env[key]);
    
    if (missing.length > 0) {
      return {
        success: false,
        error: `Missing required environment variables: ${missing.join(', ')}`
      };
    }

    return { success: true };
  }

  /**
   * Helper method to validate required config properties
   */
  protected validateRequiredProperties(config: any, required: string[]): AuthResult {
    const missing = required.filter(key => !config[key]);
    
    if (missing.length > 0) {
      return {
        success: false,
        error: `Missing required configuration properties: ${missing.join(', ')}`
      };
    }

    return { success: true };
  }

  /**
   * Helper method to make HTTP requests with proper error handling
   */
  protected async makeRequest(
    url: string, 
    options: RequestInit = {}
  ): Promise<{ success: boolean; data?: any; error?: string }> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    
    try {
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
        return {
          success: false,
          error: `HTTP ${response.status}: ${response.statusText}`
        };
      }

      const data = await response.json();
      return { success: true, data };
    } catch (error) {
      clearTimeout(timeoutId);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
}