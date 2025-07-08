/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

// Export config
export * from './config/config.js';
export * from './config/unified-config.js';

// Export auth system
export * from './auth/types.js';
export * from './auth/manager.js';
export * from './auth/providers/index.js';

// Export model system
export { 
  ModelProvider, 
  type ModelConfig, 
  type GenerationRequest, 
  type GenerationResponse,
  type ChatMessage,
  type ContentPart,
  type ToolCall as ModelToolCall,
  type IModelClient,
  type StreamingChunk,
  type ToolDefinition
} from './models/types.js';
export * from './models/manager.js';
export * from './models/clients/index.js';

// Export Core Logic
export * from './core/client.js';
export * from './core/contentGenerator.js';
export * from './core/geminiChat.js';
export * from './core/logger.js';
export * from './core/prompts.js';
export * from './core/tokenLimits.js';
export * from './core/turn.js';
export * from './core/geminiRequest.js';
export * from './core/coreToolScheduler.js';
export * from './core/nonInteractiveToolExecutor.js';

export * from './code_assist/codeAssist.js';
export * from './code_assist/oauth2.js';
export * from './code_assist/server.js';
export * from './code_assist/types.js';

// Export utilities
export * from './utils/paths.js';
export * from './utils/schemaValidator.js';
export * from './utils/errors.js';
export * from './utils/getFolderStructure.js';
export * from './utils/memoryDiscovery.js';
export * from './utils/gitIgnoreParser.js';
export * from './utils/editor.js';

// Export services
export * from './services/fileDiscoveryService.js';
export * from './services/gitService.js';

// Export base tool definitions
export * from './tools/tools.js';
export * from './tools/tool-registry.js';

// Export specific tool logic
export * from './tools/read-file.js';
export * from './tools/ls.js';
export * from './tools/grep.js';
export * from './tools/glob.js';
export * from './tools/edit.js';
export * from './tools/write-file.js';
export * from './tools/web-fetch.js';
export * from './tools/memoryTool.js';
export * from './tools/shell.js';
export * from './tools/web-search.js';
export * from './tools/read-many-files.js';
export * from './tools/mcp-client.js';
export * from './tools/mcp-tool.js';
export * from './tools/todo.js';

// Export intelligence modules
export * from './intelligence/smart-tool-filter.js';

// Export telemetry functions
export * from './telemetry/index.js';
export { sessionId } from './utils/session.js';
