/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { 
  Config,
  AuthProvider,
  AuthMethod,
  ModelProvider,
  UnifiedConfig,
  ConfigBuilder,
  AuthManager,
  ModelManager,
  AuthType
} from '@google/gemini-cli-core';
import { LoadedSettings } from './settings.js';

/**
 * Integration layer between the old Config system and new unified configuration
 */
export class ConfigIntegration {
  private authManager: AuthManager;
  private modelManager: ModelManager;

  constructor() {
    this.authManager = new AuthManager();
    this.modelManager = new ModelManager();
  }

  /**
   * Create unified config from CLI settings
   */
  async createUnifiedConfig(settings: LoadedSettings, model?: string): Promise<UnifiedConfig | null> {
    try {
      const builder = new ConfigBuilder();

      // Set up authentication
      const authConfig = this.createAuthConfigFromSettings(settings);
      if (authConfig) {
        builder.withAuth(authConfig);
      } else {
        // Try to create from environment if no settings
        builder.withAuthFromEnvironment();
      }

      // Set up model
      const selectedModel = model || settings.merged.selectedModel;
      if (selectedModel) {
        builder.withModel(selectedModel);
      } else {
        // Default to Gemini if no model specified
        builder.withModel('gemini-2.5-flash', ModelProvider.GOOGLE_GEMINI);
      }

      // Set up CLI defaults
      builder.withCLI({
        targetDir: process.cwd(),
        debugMode: false,
        approvalMode: 'default',
        showMemoryUsage: settings.merged.showMemoryUsage || false,
        checkpointing: settings.merged.checkpointing?.enabled || false,
      });

      // Set up tools
      builder.withTools({
        coreTools: settings.merged.coreTools,
        excludeTools: settings.merged.excludeTools,
        toolDiscoveryCommand: settings.merged.toolDiscoveryCommand,
        toolCallCommand: settings.merged.toolCallCommand,
        mcpServers: settings.merged.mcpServers,
      });

      // Set up telemetry
      builder.withTelemetry({
        enabled: settings.merged.telemetry?.enabled || false,
        logPrompts: settings.merged.telemetry?.logPrompts || false,
      });

      return await builder.build();
    } catch (error) {
      console.error('Failed to create unified config:', error);
      return null;
    }
  }

  /**
   * Create auth config from CLI settings
   */
  private createAuthConfigFromSettings(settings: LoadedSettings) {
    // Check for new model-based auth settings first
    if (settings.merged.authProvider && settings.merged.authMethod && settings.merged.apiKey) {
      return {
        provider: settings.merged.authProvider as AuthProvider,
        method: settings.merged.authMethod as AuthMethod,
        apiKey: settings.merged.apiKey,
      };
    }

    // Fall back to old selectedAuthType for Google auth
    if (settings.merged.selectedAuthType) {
      switch (settings.merged.selectedAuthType) {
        case AuthType.LOGIN_WITH_GOOGLE:
          return {
            provider: AuthProvider.GOOGLE,
            method: AuthMethod.GOOGLE_OAUTH,
          };
        case AuthType.USE_GEMINI:
          return {
            provider: AuthProvider.GOOGLE,
            method: AuthMethod.GOOGLE_API_KEY,
            apiKey: process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY,
          };
        case AuthType.USE_VERTEX_AI:
          return {
            provider: AuthProvider.GOOGLE,
            method: AuthMethod.GOOGLE_VERTEX_AI,
          };
      }
    }

    return null;
  }

  /**
   * Check if the current settings have a valid model and auth configuration
   */
  async validateConfiguration(settings: LoadedSettings): Promise<{ valid: boolean; errors: string[] }> {
    const unifiedConfig = await this.createUnifiedConfig(settings);
    if (!unifiedConfig) {
      return { valid: false, errors: ['Failed to create configuration'] };
    }

    const errors: string[] = [];

    // Validate authentication
    const authResult = await this.authManager.validateConfig(unifiedConfig.auth);
    if (!authResult.success) {
      errors.push(`Authentication error: ${authResult.error}`);
    }

    // Validate model availability
    const availableModels = this.modelManager.getAvailableModels(unifiedConfig.auth);
    if (availableModels.length > 0 && !availableModels.some(m => m.model === unifiedConfig.model)) {
      errors.push(`Model ${unifiedConfig.model} is not available with current authentication`);
    }

    return { valid: errors.length === 0, errors };
  }

  /**
   * Get the model that should be used based on configuration
   */
  getEffectiveModel(settings: LoadedSettings, cliModel?: string): string {
    // Priority: CLI argument > Settings > Default
    return cliModel || 
           settings.merged.selectedModel || 
           'gemini-2.5-flash';
  }

  /**
   * Check if we need to show model selection dialog
   */
  shouldShowModelSelection(settings: LoadedSettings): boolean {
    // Show if no model is selected and no auth is configured
    const hasModel = !!settings.merged.selectedModel;
    const hasAuth = !!(settings.merged.selectedAuthType || 
                      (settings.merged.authProvider && settings.merged.authMethod));
    
    return !hasModel || !hasAuth;
  }

  /**
   * Update legacy Config with new unified settings
   */
  async updateLegacyConfig(config: Config, settings: LoadedSettings): Promise<void> {
    const unifiedConfig = await this.createUnifiedConfig(settings);
    if (!unifiedConfig) {
      return;
    }

    // Note: Config is mostly read-only, so we can't update it directly
    // The model and other settings should be updated when creating a new Config instance
  }
}