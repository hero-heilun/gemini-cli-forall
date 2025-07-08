/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useCallback } from 'react';
import { Box, Text, useInput } from 'ink';
import { Colors } from '../colors.js';
import { ModelProvider } from '@google/gemini-cli-core';

interface ApiKeyDialogProps {
  provider: ModelProvider;
  onSubmit: (apiKey: string) => void;
  onCancel: () => void;
  initialErrorMessage?: string | null;
}

export function ApiKeyDialog({
  provider,
  onSubmit,
  onCancel,
  initialErrorMessage,
}: ApiKeyDialogProps): React.JSX.Element {
  const [apiKey, setApiKey] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(
    initialErrorMessage || null
  );
  const [showKey, setShowKey] = useState(true);

  const getProviderInfo = useCallback(() => {
    switch (provider) {
      case ModelProvider.ANTHROPIC_CLAUDE:
        return {
          name: 'Anthropic Claude',
          keyPrefix: 'sk-ant-',
          helpUrl: 'https://console.anthropic.com/account/keys',
          description: 'Get your API key from the Anthropic Console'
        };
      case ModelProvider.OPENAI_GPT:
        return {
          name: 'OpenAI',
          keyPrefix: 'sk-',
          helpUrl: 'https://platform.openai.com/api-keys',
          description: 'Get your API key from the OpenAI Platform'
        };
      case ModelProvider.DEEPSEEK:
        return {
          name: 'DeepSeek',
          keyPrefix: 'sk-',
          helpUrl: 'https://platform.deepseek.com/api_keys',
          description: 'Get your API key from the DeepSeek Platform'
        };
      case ModelProvider.QWEN:
        return {
          name: 'Qwen (DashScope)',
          keyPrefix: 'sk-',
          helpUrl: 'https://dashscope.console.aliyun.com/apikey',
          description: 'Get your API key from the Alibaba DashScope Console'
        };
      default:
        return {
          name: 'Unknown Provider',
          keyPrefix: '',
          helpUrl: '',
          description: 'Please enter your API key'
        };
    }
  }, [provider]);

  const providerInfo = getProviderInfo();

  const validateApiKey = useCallback((key: string): string | null => {
    if (!key.trim()) {
      return 'API key is required';
    }
    
    if (key.length < 10) {
      return 'API key seems too short';
    }

    if (providerInfo.keyPrefix && !key.startsWith(providerInfo.keyPrefix)) {
      return `${providerInfo.name} API keys typically start with "${providerInfo.keyPrefix}"`;
    }

    return null;
  }, [providerInfo]);

  const handleSubmit = useCallback(() => {
    const error = validateApiKey(apiKey);
    if (error) {
      setErrorMessage(error);
      return;
    }
    
    setErrorMessage(null);
    onSubmit(apiKey);
  }, [apiKey, validateApiKey, onSubmit]);

  const cleanPastedText = useCallback((text: string): string => text
      // Remove bracketed paste sequences
      .replace(/\x1b\[200~|\x1b\[201~/g, '')
      // Remove other common escape sequences  
      .replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '')
      // Remove control characters
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
      // Remove newlines and tabs
      .replace(/[\n\r\t]/g, '')
      // Remove common terminal artifacts
      .replace(/\[200~/g, '')
      .replace(/\[201~/g, '')
      .replace(/~\d+/g, '')
      // Remove any remaining brackets and digits that look like artifacts
      .replace(/\[(\d+)~/g, '')
      // Keep only printable ASCII characters that are valid for API keys
      .replace(/[^\x20-\x7E]/g, '')
      // Remove extra whitespace
      .trim(), []);

  const handleKeyInput = useCallback((input: string, key: any) => {
    if (key.return) {
      handleSubmit();
      return;
    }

    if (key.escape) {
      onCancel();
      return;
    }

    if (key.ctrl && input === 'h') {
      setShowKey(!showKey);
      return;
    }

    // Handle Ctrl+V for paste
    if (key.ctrl && input === 'v') {
      // Try to read from clipboard if available
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        navigator.clipboard.readText().then(text => {
          if (text) {
            const cleaned = cleanPastedText(text);
            setApiKey(cleaned);
            setErrorMessage(null);
          }
        }).catch(() => {
          // Clipboard access failed, ignore silently
        });
      }
      return;
    }

    // Handle Ctrl+A for select all (clear current input)
    if (key.ctrl && input === 'a') {
      setApiKey('');
      setErrorMessage(null);
      return;
    }

    // Handle Ctrl+L for clean API key
    if (key.ctrl && input === 'l') {
      const cleaned = cleanPastedText(apiKey);
      setApiKey(cleaned);
      setErrorMessage(null);
      return;
    }

    if (key.backspace || key.delete) {
      setApiKey(prev => prev.slice(0, -1));
      setErrorMessage(null);
      return;
    }

    // Handle input - clean any paste sequences that might come through
    if (input && !key.ctrl && !key.meta && !key.alt) {
      // Always clean the input to handle terminal paste sequences
      const cleaned = cleanPastedText(input);
      
      if (cleaned.length > 0) {
        if (cleaned.length > 1) {
          // Multi-character input (likely paste)
          setApiKey(cleaned);
        } else {
          // Single character - append to existing
          setApiKey(prev => prev + cleaned);
        }
        setErrorMessage(null);
      }
    }
  }, [handleSubmit, onCancel, showKey, cleanPastedText]);

  useInput(handleKeyInput);

  const displayKey = showKey ? apiKey : '*'.repeat(apiKey.length);

  return (
    <Box
      borderStyle="round"
      borderColor={Colors.AccentBlue}
      flexDirection="column"
      padding={1}
      width="100%"
    >
      <Text bold color={Colors.AccentBlue}>
        🔑 {providerInfo.name} API Key Required
      </Text>
      
      <Box marginTop={1}>
        <Text color={Colors.Gray}>
          {providerInfo.description}
        </Text>
      </Box>

      {providerInfo.helpUrl && (
        <Box marginTop={1}>
          <Text color={Colors.AccentBlue}>
            📖 Get your API key: {providerInfo.helpUrl}
          </Text>
        </Box>
      )}

      <Box marginTop={1}>
        <Text>API Key ({apiKey.length} chars): </Text>
        <Text color={Colors.AccentGreen}>
          {displayKey}
          <Text color={Colors.Gray}>_</Text>
        </Text>
      </Box>

      {apiKey.length > 0 && apiKey !== cleanPastedText(apiKey) && (
        <Box marginTop={1}>
          <Text color={Colors.AccentYellow}>
            ⚠️  Contains special characters. Press Ctrl+L to clean.
          </Text>
        </Box>
      )}

      {errorMessage && (
        <Box marginTop={1}>
          <Text color={Colors.AccentRed}>❌ {errorMessage}</Text>
        </Box>
      )}

      <Box marginTop={1} flexDirection="column">
        <Text color={Colors.Gray}>
          💡 Controls:
        </Text>
        <Text color={Colors.Gray}>
          • Type to enter your API key
        </Text>
        <Text color={Colors.Gray}>
          • Ctrl+V to paste from clipboard
        </Text>
        <Text color={Colors.Gray}>
          • Ctrl+A to clear all
        </Text>
        <Text color={Colors.Gray}>
          • Ctrl+L to clean special chars
        </Text>
        <Text color={Colors.Gray}>
          • Ctrl+H to {showKey ? 'hide' : 'show'} key
        </Text>
        <Text color={Colors.Gray}>
          • Enter to confirm
        </Text>
        <Text color={Colors.Gray}>
          • Esc to cancel
        </Text>
      </Box>

      <Box marginTop={1}>
        <Text color={Colors.Gray}>
          ⚠️  Your API key will be stored securely for this session only.
        </Text>
      </Box>
    </Box>
  );
}