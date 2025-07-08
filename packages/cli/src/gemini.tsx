/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { render } from 'ink';
import { AppWrapper } from './ui/App.js';
import { loadCliConfig } from './config/config.js';
import { readStdin } from './utils/readStdin.js';
import { basename } from 'node:path';
import v8 from 'node:v8';
import os from 'node:os';
import { spawn } from 'node:child_process';
import { start_sandbox } from './utils/sandbox.js';
import {
  LoadedSettings,
  loadSettings,
  SettingScope,
  USER_SETTINGS_PATH,
} from './config/settings.js';
import { themeManager } from './ui/themes/theme-manager.js';
import { getStartupWarnings } from './utils/startupWarnings.js';
import { getUserStartupWarnings } from './utils/userStartupWarnings.js';
import { runNonInteractive } from './nonInteractiveCli.js';
import { loadExtensions, Extension } from './config/extension.js';
import { cleanupCheckpoints } from './utils/cleanup.js';
import {
  ApprovalMode,
  Config,
  EditTool,
  ShellTool,
  WriteFileTool,
  sessionId,
  logUserPrompt,
  AuthType,
} from '@google/gemini-cli-core';
import { validateAuthMethod } from './config/auth.js';
import { setMaxSizedBoxDebugging } from './ui/components/shared/MaxSizedBox.js';
import { debugLogger } from './utils/logger.js';

function getNodeMemoryArgs(config: Config): string[] {
  const totalMemoryMB = os.totalmem() / (1024 * 1024);
  const heapStats = v8.getHeapStatistics();
  const currentMaxOldSpaceSizeMb = Math.floor(
    heapStats.heap_size_limit / 1024 / 1024,
  );

  // Set target to 50% of total memory
  const targetMaxOldSpaceSizeInMB = Math.floor(totalMemoryMB * 0.5);
  if (config.getDebugMode()) {
    console.debug(
      `Current heap size ${currentMaxOldSpaceSizeMb.toFixed(2)} MB`,
    );
  }

  if (process.env.GEMINI_CLI_NO_RELAUNCH) {
    return [];
  }

  if (targetMaxOldSpaceSizeInMB > currentMaxOldSpaceSizeMb) {
    if (config.getDebugMode()) {
      console.debug(
        `Need to relaunch with more memory: ${targetMaxOldSpaceSizeInMB.toFixed(2)} MB`,
      );
    }
    return [`--max-old-space-size=${targetMaxOldSpaceSizeInMB}`];
  }

  return [];
}

async function relaunchWithAdditionalArgs(additionalArgs: string[]) {
  const nodeArgs = [...additionalArgs, ...process.argv.slice(1)];
  const newEnv = { ...process.env, GEMINI_CLI_NO_RELAUNCH: 'true' };

  const child = spawn(process.execPath, nodeArgs, {
    stdio: 'inherit',
    env: newEnv,
  });

  await new Promise((resolve) => child.on('close', resolve));
  process.exit(0);
}

export async function main() {
  const workspaceRoot = process.cwd();
  const settings = loadSettings(workspaceRoot);

  await cleanupCheckpoints();
  if (settings.errors.length > 0) {
    for (const error of settings.errors) {
      let errorMessage = `Error in ${error.path}: ${error.message}`;
      if (!process.env.NO_COLOR) {
        errorMessage = `\x1b[31m${errorMessage}\x1b[0m`;
      }
      console.error(errorMessage);
      console.error(`Please fix ${error.path} and try again.`);
    }
    process.exit(1);
  }

  const extensions = loadExtensions(workspaceRoot);
  const config = await loadCliConfig(settings.merged, extensions, sessionId);

  // Set a default auth type if one isn't set for a couple of known cases.
  if (!settings.merged.selectedAuthType) {
    if (process.env.GEMINI_API_KEY) {
      settings.setValue(
        SettingScope.User,
        'selectedAuthType',
        AuthType.USE_GEMINI,
      );
    } else if (process.env.CLOUD_SHELL === 'true') {
      settings.setValue(
        SettingScope.User,
        'selectedAuthType',
        AuthType.CLOUD_SHELL,
      );
    }
  }

  setMaxSizedBoxDebugging(config.getDebugMode());

  await config.initialize();

  if (settings.merged.theme) {
    if (!themeManager.setActiveTheme(settings.merged.theme)) {
      // If the theme is not found during initial load, log a warning and continue.
      // The useThemeCommand hook in App.tsx will handle opening the dialog.
      console.warn(`Warning: Theme "${settings.merged.theme}" not found.`);
    }
  }

  // hop into sandbox if we are outside and sandboxing is enabled
  if (!process.env.SANDBOX) {
    const memoryArgs = settings.merged.autoConfigureMaxOldSpaceSize
      ? getNodeMemoryArgs(config)
      : [];
    const sandboxConfig = config.getSandbox();
    if (sandboxConfig) {
      if (settings.merged.selectedAuthType) {
        // Validate authentication here because the sandbox will interfere with the Oauth2 web redirect.
        try {
          const err = validateAuthMethod(settings.merged.selectedAuthType);
          if (err) {
            throw new Error(err);
          }
          await config.refreshAuth(settings.merged.selectedAuthType);
        } catch (err) {
          console.error('Error authenticating:', err);
          process.exit(1);
        }
      }
      await start_sandbox(sandboxConfig, memoryArgs);
      process.exit(0);
    } else {
      // Not in a sandbox and not entering one, so relaunch with additional
      // arguments to control memory usage if needed.
      if (memoryArgs.length > 0) {
        await relaunchWithAdditionalArgs(memoryArgs);
        process.exit(0);
      }
    }
  }
  let input = config.getQuestion();
  const startupWarnings = [
    ...(await getStartupWarnings()),
    ...(await getUserStartupWarnings(workspaceRoot)),
  ];

  // Debug: log input value and TTY status
  debugLogger.info('Input analysis', {
    input,
    inputType: typeof input,
    inputLength: input?.length,
    isTTY: process.stdin.isTTY,
    condition1: process.stdin.isTTY,
    condition2: (!input || input.length === 0),
    shouldEnterInteractiveMode: process.stdin.isTTY && (!input || input.length === 0)
  });

  // Add global error handlers to prevent unexpected exits
  debugLogger.info('Setting up global error handlers');
  
  process.on('uncaughtException', (error) => {
    debugLogger.error('UNCAUGHT EXCEPTION - This might cause exit', error);
    debugLogger.info('Process will continue...');
    // Don't exit - let the application continue
  });

  process.on('unhandledRejection', (reason, promise) => {
    debugLogger.error('UNHANDLED REJECTION - This might cause exit', { reason, promise: promise.toString() });
    debugLogger.info('Process will continue...');
    // Don't exit - let the application continue
  });

  process.on('exit', (code) => {
    debugLogger.processEvent('EXIT', { code });
  });

  process.on('SIGTERM', () => {
    debugLogger.processEvent('SIGTERM');
  });

  process.on('SIGINT', () => {
    debugLogger.processEvent('SIGINT');
  });

  process.on('SIGUSR1', () => {
    debugLogger.processEvent('SIGUSR1');
  });

  process.on('SIGUSR2', () => {
    debugLogger.processEvent('SIGUSR2');
  });

  debugLogger.info('Starting Gemini CLI', {
    nodeVersion: process.version,
    platform: process.platform,
    arch: process.arch,
    pid: process.pid,
    logFile: debugLogger.getLogFile()
  });

  // Render UI, passing necessary config values. Check that there is no command line question.
  if (process.stdin.isTTY && input?.length === 0) {
    console.log(`📋 Debug log: ${debugLogger.getLogFile()}`);
    setWindowTitle(basename(workspaceRoot), settings);
    render(
      <React.StrictMode>
        <AppWrapper
          config={config}
          settings={settings}
          startupWarnings={startupWarnings}
        />
      </React.StrictMode>,
      { exitOnCtrlC: false },
    );
    return;
  }
  // If not a TTY, read from stdin
  // This is for cases where the user pipes input directly into the command
  if (!process.stdin.isTTY && !input) {
    input += await readStdin();
  }
  // If still no input, check if this should be interactive mode
  if (!input) {
    // If we have an empty input string (from command line) and no stdin input,
    // this likely means the user wants interactive mode but isTTY failed to detect it
    if (input === '' && process.stdin.isTTY !== false) {
      debugLogger.info('Entering interactive mode due to no input and TTY detection uncertainty');
      console.log(`📋 Debug log: ${debugLogger.getLogFile()}`);
      setWindowTitle(basename(workspaceRoot), settings);
      render(
        <React.StrictMode>
          <AppWrapper
            config={config}
            settings={settings}
            startupWarnings={startupWarnings}
          />
        </React.StrictMode>,
        { exitOnCtrlC: false },
      );
      return;
    }
    console.error('No input provided via stdin.');
    process.exit(1);
  }

  logUserPrompt(config, {
    'event.name': 'user_prompt',
    'event.timestamp': new Date().toISOString(),
    prompt: input,
    prompt_length: input.length,
  });

  // For non-Gemini providers, skip auth and use basic config
  const provider = settings.merged.selectedProvider;
  if (provider && provider !== 'google-gemini') {
    // Skip Gemini auth for other providers
    await runNonInteractive(config, input);
  } else {
    // Non-interactive mode handled by runNonInteractive for Gemini
    const nonInteractiveConfig = await loadNonInteractiveConfig(
      config,
      extensions,
      settings,
    );
    await runNonInteractive(nonInteractiveConfig, input);
  }
  process.exit(0);
}

function setWindowTitle(title: string, settings: LoadedSettings) {
  if (!settings.merged.hideWindowTitle) {
    process.stdout.write(`\x1b]2; Gemini - ${title} \x07`);

    process.on('exit', () => {
      process.stdout.write(`\x1b]2;\x07`);
    });
  }
}

// --- Global Unhandled Rejection Handler ---
process.on('unhandledRejection', (reason, _promise) => {
  // Log other unexpected unhandled rejections as critical errors
  console.error('=========================================');
  console.error('CRITICAL: Unhandled Promise Rejection!');
  console.error('=========================================');
  console.error('Reason:', reason);
  console.error('Stack trace may follow:');
  if (!(reason instanceof Error)) {
    console.error(reason);
  }
  // Exit for genuinely unhandled errors
  process.exit(1);
});

async function loadNonInteractiveConfig(
  config: Config,
  extensions: Extension[],
  settings: LoadedSettings,
) {
  let finalConfig = config;
  if (config.getApprovalMode() !== ApprovalMode.YOLO) {
    // Everything is not allowed, ensure that only read-only tools are configured.
    const existingExcludeTools = settings.merged.excludeTools || [];
    const interactiveTools = [
      ShellTool.Name,
      EditTool.Name,
      WriteFileTool.Name,
    ];

    const newExcludeTools = [
      ...new Set([...existingExcludeTools, ...interactiveTools]),
    ];

    const nonInteractiveSettings = {
      ...settings.merged,
      excludeTools: newExcludeTools,
    };
    finalConfig = await loadCliConfig(
      nonInteractiveSettings,
      extensions,
      config.getSessionId(),
    );
  }

  return await validateNonInterActiveAuth(
    settings.merged.selectedAuthType,
    finalConfig,
  );
}

async function validateNonInterActiveAuth(
  selectedAuthType: AuthType | undefined,
  nonInteractiveConfig: Config,
) {
  // For non-interactive mode, we need minimal config validation
  // Skip auth validation for non-Gemini providers since they're handled differently
  if (!selectedAuthType && !process.env.GEMINI_API_KEY) {
    // Only require auth for Gemini, other providers handle auth differently
    console.warn(
      `Note: Auth not configured in ${USER_SETTINGS_PATH}. Some features may be limited.`,
    );
  }

  if (selectedAuthType) {
    const err = validateAuthMethod(selectedAuthType);
    if (err != null) {
      console.error(err);
      process.exit(1);
    }

    // Only refresh auth for Gemini providers
    if (selectedAuthType === AuthType.USE_GEMINI || selectedAuthType === AuthType.LOGIN_WITH_GOOGLE) {
      await nonInteractiveConfig.refreshAuth(selectedAuthType);
    }
  }

  return nonInteractiveConfig;
}
