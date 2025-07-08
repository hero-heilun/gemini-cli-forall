/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { useCallback, useState, useEffect } from 'react';
import {
  Config,
  GeminiClient,
  ModelManager,
  ModelProvider,
  AuthProvider,
  AuthMethod,
  EditorType,
} from '@google/gemini-cli-core';
import { useGeminiStream } from './useGeminiStream.js';
import { useMultiModelStream } from './useMultiModelStream.js';
import { debugLogger } from '../../utils/logger.js';
import { LoadedSettings } from '../../config/settings.js';
import type { UseHistoryManagerReturn } from './useHistoryManager.js';
import type { HistoryItem } from '../types.js';
import type { PartListUnion } from '@google/genai';

/**
 * Universal streaming hook that supports both Gemini and other model providers
 * This is a compatibility layer that extends useGeminiStream for multi-model support
 */
export const useUniversalStream = (
  settings: LoadedSettings,
  config: Config,
  history: HistoryItem[],
  addItem: UseHistoryManagerReturn['addItem'],
  setShowHelp: React.Dispatch<React.SetStateAction<boolean>>,
  setDebugMessage: (message: string) => void,
  handleSlashCommand: (
    cmd: PartListUnion,
  ) => Promise<any>,
  shellModeActive: boolean,
  getPreferredEditor: () => EditorType | undefined,
  onAuthError?: () => void,
  performMemoryRefresh?: () => Promise<void>,
) => {
  
  const selectedProvider = settings.merged.selectedProvider;
  
  // Determine which streaming approach to use
  const useGeminiProvider = selectedProvider === 'google-gemini' || !selectedProvider;
  
  // Always call both hooks but only use the appropriate one
  const geminiStreamResult = useGeminiStream(
    useGeminiProvider ? config.getGeminiClient() : null,
    history,
    addItem,
    setShowHelp,
    config,
    setDebugMessage,
    handleSlashCommand,
    shellModeActive,
    getPreferredEditor,
    onAuthError || (() => {}),
    performMemoryRefresh || (async () => {}),
  );
  
  const multiModelStreamResult = useMultiModelStream(
    settings,
    config,
    history,
    addItem,
    setShowHelp,
    setDebugMessage,
    handleSlashCommand,
    shellModeActive,
    getPreferredEditor,
    onAuthError,
    performMemoryRefresh,
  );
  
  // Log provider selection once per session
  useEffect(() => {
    if (useGeminiProvider) {
      debugLogger.info('Using Gemini streaming', { provider: selectedProvider });
    } else {
      debugLogger.info('Using multi-model streaming', { 
        provider: selectedProvider,
        model: settings.merged.selectedModel 
      });
    }
  }, [useGeminiProvider, selectedProvider, settings.merged.selectedModel]);
  
  return useGeminiProvider ? geminiStreamResult : multiModelStreamResult;
};