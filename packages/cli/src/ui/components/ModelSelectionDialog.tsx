/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import { Colors } from '../colors.js';
import { RadioButtonSelect } from './shared/RadioButtonSelect.js';
import { ModelProvider } from '@google/gemini-cli-core';

export interface ModelSelection {
  provider: ModelProvider;
  model: string;
  displayName: string;
}

interface ModelSelectionDialogProps {
  onSelect: (selection: ModelSelection) => void;
  onExit: () => void;
}

const AVAILABLE_MODELS: ModelSelection[] = [
  // Google Gemini models
  {
    provider: ModelProvider.GOOGLE_GEMINI,
    model: 'gemini-2.5-flash',
    displayName: 'Google Gemini 2.5 Flash (Fast & Efficient)'
  },
  {
    provider: ModelProvider.GOOGLE_GEMINI,
    model: 'gemini-2.5-pro',
    displayName: 'Google Gemini 2.5 Pro (Advanced Reasoning)'
  },
  // Anthropic Claude models
  {
    provider: ModelProvider.ANTHROPIC_CLAUDE,
    model: 'claude-3-5-sonnet-20241022',
    displayName: 'Anthropic Claude 3.5 Sonnet (Balanced)'
  },
  {
    provider: ModelProvider.ANTHROPIC_CLAUDE,
    model: 'claude-3-5-haiku-20241022',
    displayName: 'Anthropic Claude 3.5 Haiku (Fast)'
  },
  {
    provider: ModelProvider.ANTHROPIC_CLAUDE,
    model: 'claude-3-opus-20240229',
    displayName: 'Anthropic Claude 3 Opus (Most Capable)'
  },
  // OpenAI models
  {
    provider: ModelProvider.OPENAI_GPT,
    model: 'gpt-4',
    displayName: 'OpenAI GPT-4 (General Purpose)'
  },
  {
    provider: ModelProvider.OPENAI_GPT,
    model: 'gpt-4-turbo',
    displayName: 'OpenAI GPT-4 Turbo (Faster GPT-4)'
  },
  {
    provider: ModelProvider.OPENAI_GPT,
    model: 'gpt-3.5-turbo',
    displayName: 'OpenAI GPT-3.5 Turbo (Cost Effective)'
  },
  // DeepSeek models
  {
    provider: ModelProvider.DEEPSEEK,
    model: 'deepseek-chat',
    displayName: 'DeepSeek Chat (General Purpose)'
  },
  {
    provider: ModelProvider.DEEPSEEK,
    model: 'deepseek-coder',
    displayName: 'DeepSeek Coder (Code Specialized)'
  },
  {
    provider: ModelProvider.DEEPSEEK,
    model: 'deepseek-v3',
    displayName: 'DeepSeek V3 (Latest & Most Capable)'
  },
  // Qwen models
  {
    provider: ModelProvider.QWEN,
    model: 'qwen-turbo',
    displayName: 'Qwen Turbo (Fast & Efficient)'
  },
  {
    provider: ModelProvider.QWEN,
    model: 'qwen-plus',
    displayName: 'Qwen Plus (Enhanced Capabilities)'
  },
  {
    provider: ModelProvider.QWEN,
    model: 'qwen-max',
    displayName: 'Qwen Max (Most Capable)'
  },
  {
    provider: ModelProvider.QWEN,
    model: 'qwen2.5-coder-32b-instruct',
    displayName: 'Qwen2.5-Coder 32B (Best for Coding)'
  },
  {
    provider: ModelProvider.QWEN,
    model: 'qwen2.5-coder-7b-instruct',
    displayName: 'Qwen2.5-Coder 7B (Fast Coding Model)'
  }
];

export function ModelSelectionDialog({
  onSelect,
  onExit,
}: ModelSelectionDialogProps): React.JSX.Element {
  const [selectedIndex, setSelectedIndex] = useState(0);

  const items = AVAILABLE_MODELS.map((model, index) => ({
    label: model.displayName,
    value: index,
  }));

  const handleModelSelect = (index: number) => {
    const selectedModel = AVAILABLE_MODELS[index];
    onSelect(selectedModel);
  };

  useInput((input, key) => {
    if (key.escape) {
      onExit();
    }
  });

  const getProviderInfo = (provider: ModelProvider): string => {
    switch (provider) {
      case ModelProvider.GOOGLE_GEMINI:
        return '🔵 Google';
      case ModelProvider.ANTHROPIC_CLAUDE:
        return '🟠 Anthropic';
      case ModelProvider.OPENAI_GPT:
        return '🟢 OpenAI';
      case ModelProvider.DEEPSEEK:
        return '🔴 DeepSeek';
      case ModelProvider.QWEN:
        return '🟣 Qwen';
      default:
        return '⚪ Unknown';
    }
  };

  const selectedModel = AVAILABLE_MODELS[selectedIndex];

  return (
    <Box
      borderStyle="round"
      borderColor={Colors.Gray}
      flexDirection="column"
      padding={1}
      width="100%"
    >
      <Text bold>Select AI Model</Text>
      <Box marginTop={1}>
        <Text color={Colors.Gray}>
          Choose the AI model you want to use for this session.
        </Text>
      </Box>
      
      <Box marginTop={1}>
        <RadioButtonSelect
          items={items}
          initialIndex={0}
          onSelect={handleModelSelect}
          onHighlight={setSelectedIndex}
          isFocused={true}
        />
      </Box>

      {selectedModel && (
        <Box marginTop={1} borderStyle="single" borderColor={Colors.AccentBlue} padding={1}>
          <Box flexDirection="column">
            <Text bold color={Colors.AccentBlue}>
              {getProviderInfo(selectedModel.provider)} {selectedModel.displayName}
            </Text>
            <Box marginTop={1}>
              <Text color={Colors.Gray}>Model ID: </Text>
              <Text>{selectedModel.model}</Text>
            </Box>
            <Box marginTop={1}>
              <Text color={Colors.Gray}>
                {selectedModel.provider === ModelProvider.GOOGLE_GEMINI 
                  ? 'Authentication: Will use existing Google authentication methods'
                  : selectedModel.provider === ModelProvider.ANTHROPIC_CLAUDE
                  ? 'Authentication: Requires Anthropic API key'
                  : selectedModel.provider === ModelProvider.OPENAI_GPT
                  ? 'Authentication: Requires OpenAI API key'
                  : selectedModel.provider === ModelProvider.DEEPSEEK
                  ? 'Authentication: Requires DeepSeek API key'
                  : selectedModel.provider === ModelProvider.QWEN
                  ? 'Authentication: Requires Qwen (DashScope) API key'
                  : 'Authentication: Requires API key'
                }
              </Text>
            </Box>
          </Box>
        </Box>
      )}

      <Box marginTop={1}>
        <Text color={Colors.Gray}>(Use ↑↓ to navigate, Enter to select, Esc to exit)</Text>
      </Box>
    </Box>
  );
}