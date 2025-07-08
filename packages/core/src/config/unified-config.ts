/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import { AuthConfig, AuthProvider, AuthMethod } from '../auth/types.js';
import { ModelProvider } from '../models/types.js';
import { AuthManager } from '../auth/manager.js';
import { ModelManager } from '../models/manager.js';

/**
 * Unified configuration interface that combines authentication and model settings
 */
export interface UnifiedConfig {
  // Authentication
  auth: AuthConfig;
  
  // Model settings
  model: string;
  provider: ModelProvider;
  
  // Generation parameters
  defaultParameters?: {
    maxTokens?: number;
    temperature?: number;
    topP?: number;
    topK?: number;
    stopSequences?: string[];
    systemPrompt?: string;
  };
  
  // CLI settings
  cli?: {
    targetDir?: string;
    debugMode?: boolean;
    approvalMode?: 'default' | 'autoEdit' | 'yolo';
    showMemoryUsage?: boolean;
    checkpointing?: boolean;
  };
  
  // Tool settings
  tools?: {
    coreTools?: string[];
    excludeTools?: string[];
    toolDiscoveryCommand?: string;
    toolCallCommand?: string;
    mcpServers?: Record<string, any>;
  };
  
  // Sandbox settings
  sandbox?: {
    enabled: boolean;
    command: 'docker' | 'podman' | 'sandbox-exec';
    image?: string;
  };
  
  // Telemetry settings
  telemetry?: {
    enabled?: boolean;
    target?: string;
    endpoint?: string;
    logPrompts?: boolean;
  };
  
  // File filtering
  fileFiltering?: {
    respectGitIgnore?: boolean;
    enableRecursiveFileSearch?: boolean;
  };
  
  // Accessibility
  accessibility?: {
    disableLoadingPhrases?: boolean;
  };
  
  // Custom settings
  custom?: Record<string, any>;
}

/**
 * Configuration builder for creating and validating unified configurations
 */
export class ConfigBuilder {
  private config: Partial<UnifiedConfig> = {};
  private authManager: AuthManager;
  private modelManager: ModelManager;

  constructor() {
    this.authManager = new AuthManager();
    this.modelManager = new ModelManager();
  }

  /**
   * Set authentication configuration
   */
  withAuth(auth: AuthConfig): this {
    this.config.auth = auth;
    return this;
  }

  /**
   * Set authentication from environment variables
   */
  withAuthFromEnvironment(): this {
    const authConfig = AuthManager.createConfigFromEnvironment();
    if (authConfig) {
      this.config.auth = authConfig;
    }
    return this;
  }

  /**
   * Set model configuration
   */
  withModel(model: string, provider?: ModelProvider): this {
    this.config.model = model;
    if (provider) {
      this.config.provider = provider;
    } else {
      // Try to infer provider from model name
      const modelConfig = this.modelManager.getModel(model);
      if (modelConfig) {
        this.config.provider = modelConfig.provider;
      }
    }
    return this;
  }

  /**
   * Set default generation parameters
   */
  withDefaultParameters(params: UnifiedConfig['defaultParameters']): this {
    this.config.defaultParameters = { ...this.config.defaultParameters, ...params };
    return this;
  }

  /**
   * Set CLI configuration
   */
  withCLI(cli: UnifiedConfig['cli']): this {
    this.config.cli = { ...this.config.cli, ...cli };
    return this;
  }

  /**
   * Set tool configuration
   */
  withTools(tools: UnifiedConfig['tools']): this {
    this.config.tools = { ...this.config.tools, ...tools };
    return this;
  }

  /**
   * Set sandbox configuration
   */
  withSandbox(sandbox: UnifiedConfig['sandbox']): this {
    this.config.sandbox = sandbox;
    return this;
  }

  /**
   * Set telemetry configuration
   */
  withTelemetry(telemetry: UnifiedConfig['telemetry']): this {
    this.config.telemetry = telemetry;
    return this;
  }

  /**
   * Merge with existing configuration
   */
  merge(other: Partial<UnifiedConfig>): this {
    this.config = {
      ...this.config,
      ...other,
      defaultParameters: { ...this.config.defaultParameters, ...other.defaultParameters },
      cli: { ...this.config.cli, ...other.cli },
      tools: { ...this.config.tools, ...other.tools },
      telemetry: { ...this.config.telemetry, ...other.telemetry },
      custom: { ...this.config.custom, ...other.custom },
    };
    return this;
  }

  /**
   * Load configuration from JSON
   */
  fromJSON(json: string): this {
    try {
      const parsed = JSON.parse(json);
      return this.merge(parsed);
    } catch (error) {
      throw new Error(`Invalid JSON configuration: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Load configuration from file
   */
  async fromFile(filePath: string): Promise<this> {
    try {
      const fs = await import('fs/promises');
      const content = await fs.readFile(filePath, 'utf-8');
      return this.fromJSON(content);
    } catch (error) {
      throw new Error(`Failed to load configuration from ${filePath}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Validate the configuration
   */
  async validate(): Promise<{ valid: boolean; errors: string[] }> {
    const errors: string[] = [];

    // Validate required fields
    if (!this.config.auth) {
      errors.push('Authentication configuration is required');
    } else {
      // Validate authentication
      const authResult = await this.authManager.validateConfig(this.config.auth);
      if (!authResult.success) {
        errors.push(`Authentication validation failed: ${authResult.error}`);
      }
    }

    if (!this.config.model) {
      errors.push('Model is required');
    } else {
      // Validate model exists
      const modelConfig = this.modelManager.getModel(this.config.model);
      if (!modelConfig) {
        errors.push(`Unknown model: ${this.config.model}`);
      } else if (this.config.provider && modelConfig.provider !== this.config.provider) {
        errors.push(`Model ${this.config.model} belongs to provider ${modelConfig.provider}, not ${this.config.provider}`);
      }
    }

    // Validate model and auth compatibility
    if (this.config.auth && this.config.model) {
      const availableModels = this.modelManager.getAvailableModels(this.config.auth);
      if (availableModels.length > 0 && !availableModels.some(m => m.model === this.config.model)) {
        errors.push(`Model ${this.config.model} is not available with the configured authentication`);
      }
    }

    // Validate default parameters
    if (this.config.defaultParameters) {
      const params = this.config.defaultParameters;
      if (params.temperature !== undefined && (params.temperature < 0 || params.temperature > 1)) {
        errors.push('Temperature must be between 0 and 1');
      }
      if (params.topP !== undefined && (params.topP < 0 || params.topP > 1)) {
        errors.push('TopP must be between 0 and 1');
      }
      if (params.topK !== undefined && params.topK < 1) {
        errors.push('TopK must be at least 1');
      }
      if (params.maxTokens !== undefined && params.maxTokens < 1) {
        errors.push('MaxTokens must be at least 1');
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Build the final configuration
   */
  async build(): Promise<UnifiedConfig> {
    const validation = await this.validate();
    if (!validation.valid) {
      throw new Error(`Configuration validation failed:\n${validation.errors.join('\n')}`);
    }

    // Set defaults
    const config: UnifiedConfig = {
      auth: this.config.auth!,
      model: this.config.model!,
      provider: this.config.provider || this.modelManager.getModel(this.config.model!)!.provider,
      defaultParameters: {
        maxTokens: 1000,
        temperature: 0.7,
        ...this.config.defaultParameters,
      },
      cli: {
        targetDir: process.cwd(),
        debugMode: false,
        approvalMode: 'default',
        showMemoryUsage: false,
        checkpointing: false,
        ...this.config.cli,
      },
      tools: this.config.tools || {},
      sandbox: {
        enabled: false,
        command: 'docker',
        ...this.config.sandbox,
      },
      telemetry: {
        enabled: false,
        ...this.config.telemetry,
      },
      fileFiltering: {
        respectGitIgnore: true,
        enableRecursiveFileSearch: true,
        ...this.config.fileFiltering,
      },
      accessibility: this.config.accessibility || {},
      custom: this.config.custom || {},
    };

    return config;
  }

  /**
   * Export configuration to JSON
   */
  toJSON(): string {
    return JSON.stringify(this.config, null, 2);
  }

  /**
   * Save configuration to file
   */
  async saveToFile(filePath: string): Promise<void> {
    try {
      const fs = await import('fs/promises');
      await fs.writeFile(filePath, this.toJSON(), 'utf-8');
    } catch (error) {
      throw new Error(`Failed to save configuration to ${filePath}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

/**
 * Helper functions for common configuration scenarios
 */
export class ConfigHelpers {
  /**
   * Create a basic configuration with Google Gemini
   */
  static createGeminiConfig(apiKey: string, model = 'gemini-2.5-flash'): ConfigBuilder {
    return new ConfigBuilder()
      .withAuth({
        provider: AuthProvider.GOOGLE,
        method: AuthMethod.GOOGLE_API_KEY,
        apiKey,
      })
      .withModel(model, ModelProvider.GOOGLE_GEMINI);
  }

  /**
   * Create a basic configuration with Anthropic Claude
   */
  static createClaudeConfig(apiKey: string, model = 'claude-3-5-sonnet-20241022'): ConfigBuilder {
    return new ConfigBuilder()
      .withAuth({
        provider: AuthProvider.ANTHROPIC,
        method: AuthMethod.ANTHROPIC_API_KEY,
        apiKey,
      })
      .withModel(model, ModelProvider.ANTHROPIC_CLAUDE);
  }

  /**
   * Create configuration from environment variables
   */
  static createFromEnvironment(): ConfigBuilder {
    const builder = new ConfigBuilder().withAuthFromEnvironment();
    
    // Try to set a default model based on auth provider
    if (process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY) {
      builder.withModel('gemini-2.5-flash', ModelProvider.GOOGLE_GEMINI);
    } else if (process.env.ANTHROPIC_API_KEY) {
      builder.withModel('claude-3-5-sonnet-20241022', ModelProvider.ANTHROPIC_CLAUDE);
    } else if (process.env.OPENAI_API_KEY) {
      builder.withModel('gpt-4', ModelProvider.OPENAI_GPT);
    } else if (process.env.DEEPSEEK_API_KEY) {
      builder.withModel('deepseek-chat', ModelProvider.DEEPSEEK);
    }

    return builder;
  }

  /**
   * Create a development configuration with common settings
   */
  static createDevelopmentConfig(): ConfigBuilder {
    return ConfigHelpers.createFromEnvironment()
      .withCLI({
        targetDir: process.cwd(),
        debugMode: true,
        approvalMode: 'default',
        showMemoryUsage: true,
        checkpointing: true,
      })
      .withDefaultParameters({
        temperature: 0.7,
        maxTokens: 2000,
      })
      .withTelemetry({
        enabled: false,
      });
  }
}