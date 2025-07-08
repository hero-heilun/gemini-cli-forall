/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useCallback } from 'react';
import { LoadedSettings, SettingScope } from '../../config/settings.js';
import { ModelProvider, AuthProvider, AuthMethod } from '@google/gemini-cli-core';
import { ModelSelection } from '../components/ModelSelectionDialog.js';
import { debugLogger } from '../../utils/logger.js';

interface ModelSelectionState {
  isModelDialogOpen: boolean;
  isApiKeyDialogOpen: boolean;
  selectedModel: ModelSelection | null;
  apiKeyProvider: ModelProvider | null;
  apiKeyError: string | null;
}

export const useModelSelection = (
  settings: LoadedSettings,
  setAuthError: (error: string | null) => void,
) => {
  const [state, setState] = useState<ModelSelectionState>({
    isModelDialogOpen: shouldShowModelSelectionDialog(settings),
    isApiKeyDialogOpen: false,
    selectedModel: null,
    apiKeyProvider: null,
    apiKeyError: null,
  });

  function shouldShowModelSelectionDialog(settings: LoadedSettings): boolean {
    // Show if no model is selected OR no auth is configured
    const hasModel = !!settings.merged.selectedModel;
    const hasAuth = !!(settings.merged.selectedAuthType || 
                      (settings.merged.authProvider && settings.merged.authMethod));
    
    // Only log once during initialization, not on every render
    return !hasModel || !hasAuth;
  }

  const openModelDialog = useCallback(() => {
    setState(prev => ({
      ...prev,
      isModelDialogOpen: true,
      isApiKeyDialogOpen: false,
      apiKeyError: null,
    }));
  }, []);

  const closeModelDialog = useCallback(() => {
    setState(prev => ({
      ...prev,
      isModelDialogOpen: false,
    }));
  }, []);

  const openApiKeyDialog = useCallback((provider: ModelProvider) => {
    setState(prev => ({
      ...prev,
      isModelDialogOpen: false,
      isApiKeyDialogOpen: true,
      apiKeyProvider: provider,
      apiKeyError: null,
    }));
  }, []);

  const closeApiKeyDialog = useCallback(() => {
    setState(prev => ({
      ...prev,
      isApiKeyDialogOpen: false,
      apiKeyProvider: null,
      apiKeyError: null,
    }));
  }, []);

  const handleModelSelect = useCallback((selection: ModelSelection) => {
    setState(prev => ({ ...prev, selectedModel: selection }));

    // Store model selection in settings
    settings.setValue(SettingScope.User, 'selectedModel', selection.model);
    settings.setValue(SettingScope.User, 'selectedProvider', selection.provider);

    // Handle authentication based on provider
    if (selection.provider === ModelProvider.GOOGLE_GEMINI) {
      // For Google, use existing auth flow
      setState(prev => ({
        ...prev,
        isModelDialogOpen: false,
        isApiKeyDialogOpen: false,
      }));
      setAuthError(null);
    } else {
      // For other providers, show API key dialog
      openApiKeyDialog(selection.provider);
    }
  }, [settings, setAuthError, openApiKeyDialog]);

  const handleApiKeySubmit = useCallback((apiKey: string) => {
    if (!state.selectedModel || !state.apiKeyProvider) {
      return;
    }

    try {
      // Store API key and set up auth config
      const authProvider = state.apiKeyProvider === ModelProvider.ANTHROPIC_CLAUDE 
        ? AuthProvider.ANTHROPIC 
        : state.apiKeyProvider === ModelProvider.OPENAI_GPT
        ? AuthProvider.OPENAI
        : state.apiKeyProvider === ModelProvider.DEEPSEEK
        ? AuthProvider.DEEPSEEK
        : state.apiKeyProvider === ModelProvider.QWEN
        ? AuthProvider.QWEN
        : AuthProvider.CUSTOM;

      const authMethod = state.apiKeyProvider === ModelProvider.ANTHROPIC_CLAUDE
        ? AuthMethod.ANTHROPIC_API_KEY
        : state.apiKeyProvider === ModelProvider.OPENAI_GPT
        ? AuthMethod.OPENAI_API_KEY
        : state.apiKeyProvider === ModelProvider.DEEPSEEK
        ? AuthMethod.DEEPSEEK_API_KEY
        : state.apiKeyProvider === ModelProvider.QWEN
        ? AuthMethod.QWEN_API_KEY
        : AuthMethod.CUSTOM_API_KEY;

      // Store auth settings
      debugLogger.info('Saving auth settings', {
        authProvider,
        authMethod,
        apiKeyLength: apiKey.length,
        selectedModel: state.selectedModel
      });
      
      settings.setValue(SettingScope.User, 'authProvider', authProvider);
      settings.setValue(SettingScope.User, 'authMethod', authMethod);
      settings.setValue(SettingScope.User, 'apiKey', apiKey);

      debugLogger.info('Settings after save', {
        authProvider: settings.merged.authProvider,
        authMethod: settings.merged.authMethod,
        hasApiKey: !!settings.merged.apiKey,
        selectedModel: settings.merged.selectedModel,
        selectedProvider: settings.merged.selectedProvider
      });

      setState(prev => ({
        ...prev,
        isApiKeyDialogOpen: false,
        apiKeyProvider: null,
        apiKeyError: null,
      }));

      setAuthError(null);
    } catch (error) {
      setState(prev => ({
        ...prev,
        apiKeyError: error instanceof Error ? error.message : 'Failed to configure authentication',
      }));
    }
  }, [state.selectedModel, state.apiKeyProvider, settings, setAuthError]);

  const handleApiKeyCancel = useCallback(() => {
    // Go back to model selection
    setState(prev => ({
      ...prev,
      isModelDialogOpen: true,
      isApiKeyDialogOpen: false,
      apiKeyProvider: null,
      apiKeyError: null,
      selectedModel: null,
    }));
  }, []);

  const hasValidModelAndAuth = useCallback((): boolean => {
    const hasModel = !!settings.merged.selectedModel;
    const hasAuth = !!settings.merged.authProvider || !!settings.merged.selectedAuthType;
    return hasModel && hasAuth;
  }, [settings.merged.selectedModel, settings.merged.authProvider, settings.merged.selectedAuthType]);

  return {
    isModelDialogOpen: state.isModelDialogOpen,
    isApiKeyDialogOpen: state.isApiKeyDialogOpen,
    selectedModel: state.selectedModel,
    apiKeyProvider: state.apiKeyProvider,
    apiKeyError: state.apiKeyError,
    openModelDialog,
    closeModelDialog,
    handleModelSelect,
    handleApiKeySubmit,
    handleApiKeyCancel,
    hasValidModelAndAuth,
  };
};