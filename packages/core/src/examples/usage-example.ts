/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { AuthProvider, AuthMethod } from '../auth/types.js';
import { AuthManager } from '../auth/manager.js';
import { ModelManager } from '../models/manager.js';
import { ConfigBuilder, ConfigHelpers } from '../config/unified-config.js';

/**
 * Example usage of the unified authentication and model system
 */
export class UsageExample {
  /**
   * Example 1: Using Google Gemini with API key
   */
  static async exampleGemini() {
    console.log('🚀 Example 1: Google Gemini with API key');
    
    // Create configuration
    const config = await ConfigHelpers
      .createGeminiConfig('your-gemini-api-key', 'gemini-2.5-flash')
      .withDefaultParameters({
        temperature: 0.7,
        maxTokens: 1000,
      })
      .build();

    // Create managers
    const authManager = new AuthManager();
    const modelManager = new ModelManager();

    // Validate authentication
    const authResult = await authManager.authenticate(config.auth);
    if (!authResult.success) {
      console.error('❌ Authentication failed:', authResult.error);
      return;
    }
    
    console.log('✅ Authentication successful');

    // Generate content
    try {
      const response = await modelManager.generateContent(
        config.model,
        config.auth,
        {
          messages: [
            { role: 'user', content: 'Hello! Tell me a joke.' }
          ],
          parameters: config.defaultParameters
        }
      );

      console.log('🤖 Response:', response.choices[0].message.content);
    } catch (error) {
      console.error('❌ Generation failed:', error);
    }
  }

  /**
   * Example 2: Using Anthropic Claude with streaming
   */
  static async exampleClaude() {
    console.log('🚀 Example 2: Anthropic Claude with streaming');
    
    // Create configuration
    const config = await ConfigHelpers
      .createClaudeConfig('your-anthropic-api-key', 'claude-3-5-sonnet-20241022')
      .withDefaultParameters({
        temperature: 0.8,
        maxTokens: 2000,
      })
      .build();

    const modelManager = new ModelManager();

    // Generate content with streaming
    try {
      console.log('🤖 Streaming response:');
      
      for await (const chunk of modelManager.generateContentStream(
        config.model,
        config.auth,
        {
          messages: [
            { role: 'user', content: 'Write a short poem about coding.' }
          ],
          parameters: config.defaultParameters
        }
      )) {
        const content = chunk.choices[0]?.delta?.content || '';
        if (typeof content === 'string') {
          process.stdout.write(content);
        }
      }
      
      console.log('\n✅ Streaming complete');
    } catch (error) {
      console.error('❌ Streaming failed:', error);
    }
  }

  /**
   * Example 3: Dynamic provider selection based on environment
   */
  static async exampleDynamicProvider() {
    console.log('🚀 Example 3: Dynamic provider selection');
    
    // Create configuration from environment
    const builder = ConfigHelpers.createFromEnvironment()
      .withDefaultParameters({
        temperature: 0.7,
        maxTokens: 1500,
      });

    try {
      const config = await builder.build();
      console.log(`✅ Using provider: ${config.provider}`);
      console.log(`✅ Using model: ${config.model}`);
      
      const authManager = new AuthManager();
      const status = await authManager.getAuthStatus(config.auth);
      console.log(`🔐 Auth status: ${status}`);
      
    } catch (error) {
      console.error('❌ Configuration failed:', error instanceof Error ? error.message : 'Unknown error');
      console.log('💡 Make sure to set one of the following environment variables:');
      console.log('   - GEMINI_API_KEY');
      console.log('   - ANTHROPIC_API_KEY');
      console.log('   - OPENAI_API_KEY');
    }
  }

  /**
   * Example 4: Model capabilities checking
   */
  static async exampleModelCapabilities() {
    console.log('🚀 Example 4: Model capabilities checking');
    
    const modelManager = new ModelManager();
    
    const models = ['gemini-2.5-flash', 'claude-3-5-sonnet-20241022'];
    
    for (const model of models) {
      console.log(`\n📊 Capabilities for ${model}:`);
      console.log(`  • Streaming: ${modelManager.supportsStreaming(model)}`);
      console.log(`  • Function calling: ${modelManager.supportsFunctionCalling(model)}`);
      console.log(`  • Multimodal: ${modelManager.isMultimodal(model)}`);
      console.log(`  • Max tokens: ${modelManager.getMaxTokens(model)}`);
      console.log(`  • Max context: ${modelManager.getMaxContextLength(model)}`);
      console.log(`  • MIME types: ${modelManager.getSupportedMimeTypes(model).join(', ')}`);
    }
  }

  /**
   * Example 5: Configuration validation and error handling
   */
  static async exampleValidation() {
    console.log('🚀 Example 5: Configuration validation');
    
    // Test invalid configuration
    try {
      await new ConfigBuilder()
        .withAuth({
          provider: AuthProvider.ANTHROPIC,
          method: AuthMethod.ANTHROPIC_API_KEY,
          apiKey: 'invalid-key'
        })
        .withModel('invalid-model')
        .withDefaultParameters({
          temperature: 2.0, // Invalid - should be 0-1
          maxTokens: -100   // Invalid - should be positive
        })
        .build();
      console.log('❌ Unexpected: validation should have failed');
    } catch (error) {
      console.log('❌ Expected validation errors:');
      console.log(error instanceof Error ? error.message : 'Unknown error');
    }
    
    // Test valid configuration
    try {
      const validConfig = await new ConfigBuilder()
        .withAuth({
          provider: AuthProvider.ANTHROPIC,
          method: AuthMethod.ANTHROPIC_API_KEY,
          apiKey: 'sk-ant-example'
        })
        .withModel('claude-3-5-sonnet-20241022')
        .withDefaultParameters({
          temperature: 0.7,
          maxTokens: 1000
        })
        .build();
      
      console.log('✅ Valid configuration created:', validConfig.model);
    } catch (error) {
      console.log('❌ Unexpected error:', error instanceof Error ? error.message : 'Unknown error');
    }
  }

  /**
   * Example 6: Multi-provider comparison
   */
  static async exampleMultiProvider() {
    console.log('🚀 Example 6: Multi-provider comparison');
    
    // Define configurations for different providers
    const configs = [
      {
        name: 'Gemini Flash',
        config: await ConfigHelpers
          .createGeminiConfig('test-key', 'gemini-2.5-flash')
          .build()
      },
      {
        name: 'Claude Sonnet',
        config: await ConfigHelpers
          .createClaudeConfig('test-key', 'claude-3-5-sonnet-20241022')
          .build()
      }
    ];
    
    const modelManager = new ModelManager();
    
    console.log('\n📊 Provider Comparison:');
    console.log('┌─────────────────────┬──────────────┬────────────┬──────────────┬────────────────┐');
    console.log('│ Model               │ Max Tokens   │ Context    │ Multimodal   │ Function Call  │');
    console.log('├─────────────────────┼──────────────┼────────────┼──────────────┼────────────────┤');
    
    for (const { name, config } of configs) {
      const maxTokens = modelManager.getMaxTokens(config.model) || 'N/A';
      const context = modelManager.getMaxContextLength(config.model) || 'N/A';
      const multimodal = modelManager.isMultimodal(config.model) ? '✅' : '❌';
      const functionCall = modelManager.supportsFunctionCalling(config.model) ? '✅' : '❌';
      
      console.log(`│ ${name.padEnd(19)} │ ${String(maxTokens).padEnd(12)} │ ${String(context).padEnd(10)} │ ${multimodal.padEnd(12)} │ ${functionCall.padEnd(14)} │`);
    }
    
    console.log('└─────────────────────┴──────────────┴────────────┴──────────────┴────────────────┘');
  }
}

// Run examples if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  console.log('🎯 Running usage examples...\n');
  
  // Note: These examples require valid API keys to work
  // Set the appropriate environment variables before running
  
  Promise.resolve()
    .then(() => UsageExample.exampleModelCapabilities())
    .then(() => UsageExample.exampleDynamicProvider())
    .then(() => UsageExample.exampleValidation())
    .then(() => UsageExample.exampleMultiProvider())
    .catch(console.error);
}