/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import { useInput } from 'ink';
import path from 'path';
import {
  Config,
  ModelManager,
  ModelProvider,
  AuthProvider,
  AuthMethod,
  logUserPrompt,
  MessageSenderType,
  EditorType,
} from '@google/gemini-cli-core';
import { 
  StreamingState, 
  HistoryItem, 
  HistoryItemWithoutId, 
  MessageType 
} from '../types.js';
import { LoadedSettings } from '../../config/settings.js';
import { debugLogger } from '../../utils/logger.js';
import type { UseHistoryManagerReturn } from './useHistoryManager.js';
import type { PartListUnion } from '@google/genai';
import { isAtCommand } from '../utils/commandUtils.js';
import { handleAtCommand } from './atCommandProcessor.js';
import { useShellCommandProcessor } from './shellCommandProcessor.js';
import { 
  useReactToolScheduler,
  mapToDisplay as mapTrackedToolCallsToDisplay,
} from './useReactToolScheduler.js';

/**
 * Multi-model streaming hook that supports various AI providers
 * This implements real streaming for non-Gemini models
 */
export const useMultiModelStream = (
  settings: LoadedSettings,
  config: Config,
  history: HistoryItem[],
  addItem: UseHistoryManagerReturn['addItem'],
  setShowHelp: React.Dispatch<React.SetStateAction<boolean>>,
  onDebugMessage: (message: string) => void,
  handleSlashCommand: (
    cmd: PartListUnion,
  ) => Promise<any>,
  shellModeActive: boolean,
  getPreferredEditor: () => EditorType | undefined,
  onAuthError?: () => void,
  performMemoryRefresh?: () => Promise<void>,
) => {
  const [streamingState, setStreamingState] = useState<StreamingState>(StreamingState.Idle);
  const [initError, setInitError] = useState<string | null>(null);
  const [pendingHistoryItem, setPendingHistoryItem] = useState<HistoryItemWithoutId | null>(null);
  const abortController = useRef<AbortController | null>(null);
  const currentContent = useRef<string>('');
  const modelManager = useRef(new ModelManager());
  const hasActiveToolCalls = useRef<boolean>(false);

  // Tool support
  const [toolCalls, scheduleToolCalls, markToolsAsSubmitted] = useReactToolScheduler(
    async (completedToolCallsFromScheduler) => {
      // Handle completed tool calls
      if (completedToolCallsFromScheduler.length > 0) {
        debugLogger.info('Tool calls completed', { count: completedToolCallsFromScheduler.length });
        
        addItem({
          type: 'tool_group',
          tools: completedToolCallsFromScheduler.map(tc => ({
            callId: tc.request.callId,
            name: tc.request.name,
            description: 'tool' in tc ? (tc.tool?.description || tc.request.name) : tc.request.name,
            resultDisplay: 'response' in tc ? tc.response.resultDisplay : undefined,
            status: tc.status as any,
            confirmationDetails: undefined, // No confirmation for completed tools
          })),
        } as HistoryItemWithoutId, Date.now());
        
        // Set streaming state back to idle after tools complete
        hasActiveToolCalls.current = false;
        setStreamingState(StreamingState.Idle);
        setPendingHistoryItem(null);
        debugLogger.info('All tools completed, setting state back to idle');
      }
    },
    config,
    setPendingHistoryItem,
    () => getPreferredEditor(), // getPreferredEditor
  );
  const toolCallsDisplay = mapTrackedToolCallsToDisplay(toolCalls);

  // Shell command processing
  const { handleShellCommand } = useShellCommandProcessor(
    addItem,
    setPendingHistoryItem,
    async (done: Promise<void>) => {
      setStreamingState(StreamingState.Responding);
      await done;
      setStreamingState(StreamingState.Idle);
    }, // onExec
    onDebugMessage,
    config,
    null, // geminiClient - we don't have one for multi-model
  );

  // Handle keyboard interrupts (Ctrl+C and ESC)
  useInput((input, key) => {
    if ((key.ctrl && input === 'c') || key.escape) {
      if (streamingState === StreamingState.Responding) {
        onDebugMessage('Interrupting generation...');
        abortStreaming();
      }
    }
  });

  const abortStreaming = useCallback(() => {
    if (abortController.current) {
      abortController.current.abort();
      abortController.current = null;
    }
    
    // Add cancel feedback message
    addItem(
      {
        type: MessageType.INFO,
        text: 'Request cancelled.',
      },
      Date.now(),
    );
    
    setStreamingState(StreamingState.Idle);
  }, [addItem]);

  // Convert history to chat messages
  const convertHistoryToChatMessages = useCallback((history: HistoryItem[]) => {
    const messages: any[] = [];
    
    for (const item of history) {
      if (item.type === 'user') {
        messages.push({
          role: 'user',
          content: item.text
        });
      } else if (item.type === 'gemini_content') {
        messages.push({
          role: 'assistant',
          content: item.text
        });
      } else if (item.type === 'tool_group') {
        // Convert tool calls to proper message format
        const toolCalls = item.tools.map(tool => ({
          id: tool.callId,
          type: 'function',
          function: {
            name: tool.name,
            arguments: tool.description // This contains the args as JSON string
          }
        }));
        
        // Add assistant message with tool calls
        messages.push({
          role: 'assistant',
          content: '',
          tool_calls: toolCalls
        });
        
        // Add tool results as tool messages
        item.tools.forEach(tool => {
          if (tool.resultDisplay) {
            messages.push({
              role: 'tool',
              tool_call_id: tool.callId,
              content: tool.resultDisplay
            });
          }
        });
      }
    }
    
    return messages;
  }, []);

  // Create model client with memoization to prevent recreating on every render
  const createModelClient = useCallback(async () => {
    const selectedProvider = settings.merged.selectedProvider;
    const selectedModel = settings.merged.selectedModel;
    
    if (!selectedProvider || !selectedModel) {
      throw new Error('No model or provider selected');
    }

    // Create auth config
    const authConfig = {
      provider: settings.merged.authProvider as AuthProvider,
      method: settings.merged.authMethod as AuthMethod,
      apiKey: settings.merged.apiKey,
    };

    debugLogger.info('Creating model client for multi-model streaming', {
      provider: selectedProvider,
      model: selectedModel,
      authProvider: authConfig.provider,
      authMethod: authConfig.method,
      hasApiKey: !!authConfig.apiKey
    });

    return await modelManager.current.createClient(selectedModel, authConfig);
  }, [
    settings.merged.selectedProvider,
    settings.merged.selectedModel,
    settings.merged.authProvider,
    settings.merged.authMethod,
    settings.merged.apiKey
  ]);

  const submitQuery = useCallback(async (input: string) => {
    if (streamingState !== StreamingState.Idle) {
      return;
    }

    // Handle @ commands first
    if (isAtCommand(input)) {
      const result = await handleAtCommand({
        query: input,
        config,
        addItem,
        onDebugMessage,
        messageId: Date.now(),
        signal: abortController.current!.signal,
      });
      if (!result.shouldProceed) {
        return;
      }
      // Use the processed query
      if (result.processedQuery) {
        if (Array.isArray(result.processedQuery)) {
          const processedText = result.processedQuery.map((part: any) => 
            typeof part === 'string' ? part : part.text || ''
          ).join('');
          input = processedText;
        } else {
          input = typeof result.processedQuery === 'string' ? result.processedQuery : '';
        }
      }
    }

    // Handle shell commands
    if (shellModeActive && handleShellCommand) {
      const shellResult = handleShellCommand(input, abortController.current!.signal);
      if (shellResult) {
        return;
      }
    }

    setStreamingState(StreamingState.Responding);
    setInitError(null);
    currentContent.current = '';
    abortController.current = new AbortController();

    // Log user prompt
    logUserPrompt(config, {
      'event.name': 'user_prompt',
      'event.timestamp': new Date().toISOString(),
      prompt: input,
      prompt_length: input.length,
    });

    // Add user message to history
    addItem({
      type: 'user',
      text: input,
    } as HistoryItemWithoutId, Date.now());

    // Create initial assistant message as pending item
    setPendingHistoryItem({
      type: 'gemini_content',
      text: '',
    } as HistoryItemWithoutId);

    try {
      const client = await createModelClient();
      const messages = convertHistoryToChatMessages(history);
      messages.push({ role: 'user', content: input });

      // Get available tools from config
      let availableTools: any[] = [];
      try {
        debugLogger.info('Attempting to get tool registry from config');
        let toolRegistry = await config.getToolRegistry();
        
        // If tool registry is not initialized, create it manually for multi-model support
        if (!toolRegistry) {
          debugLogger.info('Tool registry not found, creating new one for multi-model support');
          toolRegistry = await config.createToolRegistry();
          debugLogger.info('Tool registry created successfully');
        }
        
        debugLogger.info('Tool registry received', { 
          hasRegistry: !!toolRegistry, 
          registryType: typeof toolRegistry,
          hasGetAllTools: toolRegistry && typeof toolRegistry.getAllTools === 'function',
          registryKeys: toolRegistry ? Object.keys(toolRegistry) : 'none'
        });
        
        if (toolRegistry && typeof toolRegistry.getAllTools === 'function') {
          availableTools = toolRegistry.getAllTools();
          debugLogger.info('Tools retrieved successfully', { toolCount: availableTools.length });
        } else {
          debugLogger.info('Tool registry not available or getAllTools method missing', {
            toolRegistry: !!toolRegistry,
            getAllToolsMethod: toolRegistry && typeof toolRegistry.getAllTools
          });
        }
      } catch (error) {
        debugLogger.error('Error getting tools from registry', error);
      }
      
      // For non-Gemini models, provide limited tools to prevent inappropriate usage
      // This is a temporary solution for models that aren't as smart as Gemini at tool selection
      let filteredTools = availableTools;
      
      // Only provide basic tools for models that might misuse advanced tools
      const selectedProvider = settings.merged.selectedProvider;
      if (selectedProvider !== 'google') {
        // Provide only essential tools to prevent misuse by non-Gemini models
        // qwen should get slightly more tools since it's good at coding
        const safeToolNames = selectedProvider === 'qwen' 
          ? ['web_search', 'memory', 'ls', 'read_file', 'write_file', 'edit', 'shell', 'grep', 'glob']
          : ['web_search', 'memory', 'ls', 'read_file', 'shell'];
        
        filteredTools = availableTools.filter(tool => safeToolNames.includes(tool.name));
        
        debugLogger.info('Limited tool set applied for non-Gemini model', {
          provider: selectedProvider,
          originalToolCount: availableTools.length,
          filteredToolCount: filteredTools.length,
          filteredToolNames: filteredTools.map(t => t.name)
        });
      } else {
        debugLogger.info('Full tool set provided for Gemini model', {
          toolCount: availableTools.length,
          toolNames: availableTools.map(t => t.name)
        });
      }
      
      const request = {
        messages,
        parameters: {
          stream: true,
          maxTokens: 4000,
          temperature: 0.7
        },
        // Include filtered tools if available
        tools: filteredTools.length > 0 ? filteredTools.map((tool: any) => ({
          type: 'function' as const,
          function: {
            name: tool.name,
            description: tool.description,
            parameters: tool.parameters
          }
        })) : undefined
      };

      debugLogger.info('Starting multi-model streaming', {
        provider: client.provider,
        model: client.config.model,
        messageCount: messages.length,
        toolsAvailable: availableTools.length,
        toolNames: availableTools.map(t => t.name),
        hasTools: !!request.tools,
        toolCount: request.tools?.length || 0
      });

      const toolCallsMap = new Map<string, any>(); // Map to accumulate tool calls by ID

      // Stream response
      for await (const chunk of client.generateContentStream(request)) {
        if (abortController.current?.signal.aborted) {
          debugLogger.info('Stream aborted by user');
          break;
        }

        // Debug: Log the entire chunk to see what DeepSeek returns
        if (process.env.DEBUG || config.getDebugMode()) {
          debugLogger.info('DeepSeek chunk received', { chunk: JSON.stringify(chunk, null, 2) });
        }

        // Handle content chunks
        if (chunk.choices?.[0]?.delta?.content) {
          const content = chunk.choices[0].delta.content;
          currentContent.current += content;
          
          // Update pending history item for real-time streaming display
          setPendingHistoryItem({
            type: 'gemini_content',
            text: currentContent.current,
          } as HistoryItemWithoutId);
        }

        // Handle tool calls in streaming chunks - properly accumulate streaming tool calls
        const delta = chunk.choices?.[0]?.delta as any;
        if (delta?.toolCalls || delta?.tool_calls) {
          const toolCalls = delta.toolCalls || delta.tool_calls;
          debugLogger.info('Tool call chunks found in delta', { toolCalls });
          
          for (const toolCall of toolCalls) {
            if (toolCall.id) {
              // This is a new tool call or an update to an existing one
              if (!toolCallsMap.has(toolCall.id)) {
                toolCallsMap.set(toolCall.id, {
                  id: toolCall.id,
                  type: toolCall.type,
                  function: {
                    name: toolCall.function?.name || '',
                    arguments: toolCall.function?.arguments || ''
                  }
                });
              } else {
                // Accumulate arguments for existing tool call
                const existing = toolCallsMap.get(toolCall.id);
                if (toolCall.function?.name) {
                  existing.function.name = toolCall.function.name;
                }
                if (toolCall.function?.arguments) {
                  existing.function.arguments += toolCall.function.arguments;
                }
              }
            } else if (toolCall.function?.arguments) {
              // This might be a continuation of arguments for the last tool call
              const lastToolCall = Array.from(toolCallsMap.values()).pop();
              if (lastToolCall) {
                lastToolCall.function.arguments += toolCall.function.arguments;
              }
            }
          }
        }

        // Also check if tool calls are in the choice itself (non-streaming format)
        const choice = chunk.choices?.[0] as any;
        if (choice?.message?.toolCalls || choice?.message?.tool_calls) {
          const toolCalls = choice.message.toolCalls || choice.message.tool_calls;
          debugLogger.info('Tool calls found in message', { toolCalls });
          for (const toolCall of toolCalls) {
            if (toolCall.id) {
              toolCallsMap.set(toolCall.id, toolCall);
            }
          }
        }

        // Check for completion
        if (chunk.choices?.[0]?.finishReason === 'stop' || chunk.choices?.[0]?.finishReason === 'tool_calls') {
          debugLogger.info('Stream completed', { finishReason: chunk.choices[0].finishReason });
          break;
        }
      }

      // Convert accumulated tool calls to array
      const pendingToolCalls = Array.from(toolCallsMap.values());

      // Process any tool calls that were detected
      if (pendingToolCalls.length > 0) {
        debugLogger.info('Processing tool calls', { count: pendingToolCalls.length, toolCalls: pendingToolCalls });
        
        const toolCallRequests = pendingToolCalls.map(toolCall => {
          let args = {};
          
          // Safely parse JSON arguments
          if (toolCall.function?.arguments) {
            try {
              debugLogger.info('Parsing tool call arguments', { arguments: toolCall.function.arguments });
              args = JSON.parse(toolCall.function.arguments);
            } catch (error) {
              debugLogger.error('Failed to parse tool call arguments as JSON', { 
                arguments: toolCall.function.arguments, 
                error: error instanceof Error ? error.message : String(error)
              });
              // Try to handle partial JSON or treat as plain text
              args = { content: toolCall.function.arguments };
            }
          }

          // Handle file path conversion for write_file tool
          if (toolCall.function?.name === 'write_file' && args && typeof args === 'object') {
            const writeArgs = args as any;
            if (writeArgs.file_path && typeof writeArgs.file_path === 'string') {
              // Convert relative paths to absolute paths
              if (!writeArgs.file_path.startsWith('/')) {
                const originalPath = writeArgs.file_path;
                writeArgs.file_path = path.resolve(process.cwd(), writeArgs.file_path);
                debugLogger.info('Converted relative path to absolute', { 
                  original: originalPath,
                  resolved: writeArgs.file_path 
                });
              }
            }
          }
          
          const request = {
            callId: toolCall.id,
            name: toolCall.function?.name || 'unknown',
            args,
            isClientInitiated: false // Tool calls from AI are not client-initiated
          };
          debugLogger.info('Created tool call request', request);
          return request;
        });

        // Schedule tool calls using the tool scheduler
        debugLogger.info('Scheduling tool calls', { requests: toolCallRequests });
        hasActiveToolCalls.current = true;
        
        try {
          scheduleToolCalls(toolCallRequests, abortController.current.signal);
          debugLogger.info('Tool calls scheduled successfully, keeping streaming state active');
        } catch (scheduleError) {
          debugLogger.error('Failed to schedule tool calls', scheduleError);
          hasActiveToolCalls.current = false;
          
          // Add error to history
          addItem({
            type: 'error',
            text: `Failed to schedule tool calls: ${scheduleError instanceof Error ? scheduleError.message : String(scheduleError)}`,
          } as HistoryItemWithoutId, Date.now());
        }
      } else {
        debugLogger.info('No tool calls detected in response');
        
        // Only add content to history if there are no tool calls
        if (currentContent.current.length > 0) {
          addItem({
            type: 'gemini_content',
            text: currentContent.current,
          } as HistoryItemWithoutId, Date.now());
          setPendingHistoryItem(null);
        }
      }

      debugLogger.info('Multi-model streaming completed successfully', {
        contentLength: currentContent.current.length,
        toolCallsDetected: pendingToolCalls.length
      });

    } catch (error) {
      debugLogger.error('Multi-model streaming error', error);
      
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      
      addItem({
        type: 'error',
        text: `Error: ${errorMessage}`,
      } as HistoryItemWithoutId, Date.now());

      setInitError(errorMessage);
    } finally {
      // Only reset state if no tools were scheduled
      if (!hasActiveToolCalls.current) {
        setStreamingState(StreamingState.Idle);
        setPendingHistoryItem(null);
      }
      abortController.current = null;
    }
  }, [
    streamingState,
    config,
    createModelClient,
    convertHistoryToChatMessages,
    scheduleToolCalls,
  ]);

  // Combine pending items like useGeminiStream does
  const allPendingItems: HistoryItemWithoutId[] = [];
  if (pendingHistoryItem) {
    allPendingItems.push(pendingHistoryItem);
  }
  if (toolCallsDisplay.tools.length > 0) {
    allPendingItems.push(toolCallsDisplay);
  }

  return {
    streamingState,
    submitQuery,
    initError,
    pendingHistoryItems: allPendingItems,
    thought: null, // No thought support for now
    abortStreaming,
  };
};