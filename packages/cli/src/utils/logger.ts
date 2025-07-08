/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import * as fs from 'fs';
import * as path from 'path';

// 使用项目目录下的 .gemini 文件夹存储日志和配置
const PROJECT_ROOT = process.cwd();
const LOG_DIR = path.join(PROJECT_ROOT, '.gemini', 'logs');
const LOG_FILE = path.join(LOG_DIR, `debug-${new Date().toISOString().slice(0, 10)}.log`);

// 确保日志目录存在
try {
  fs.mkdirSync(LOG_DIR, { recursive: true });
} catch (error) {
  // 忽略创建目录的错误
}

export class Logger {
  private static instance: Logger;
  private logFile: string;

  constructor() {
    this.logFile = LOG_FILE;
    this.log('🚀 Logger initialized', { timestamp: new Date().toISOString() });
  }

  static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  log(message: string, data?: any): void {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      message,
      data: data ? JSON.stringify(data, null, 2) : undefined
    };

    const logLine = `[${timestamp}] ${message}${data ? '\n' + JSON.stringify(data, null, 2) : ''}\n`;

    // 写入文件
    try {
      fs.appendFileSync(this.logFile, logLine);
    } catch (error) {
      console.error('Failed to write to log file:', error);
    }

    // 同时输出到控制台 - 使用正确的日志级别
    console.log(message, data || '');
  }

  error(message: string, error?: any): void {
    const errorData = {
      message: error?.message,
      stack: error?.stack,
      name: error?.name,
      code: error?.code,
      type: typeof error,
      raw: error
    };

    const timestamp = new Date().toISOString();
    const logLine = `[${timestamp}] 🚨 ERROR: ${message}${errorData ? '\n' + JSON.stringify(errorData, null, 2) : ''}\n`;

    // 写入文件
    try {
      fs.appendFileSync(this.logFile, logLine);
    } catch (writeError) {
      console.error('Failed to write to log file:', writeError);
    }

    // 输出到控制台 - 使用console.error
    console.error(`🚨 ERROR: ${message}`, errorData || '');
  }

  debug(message: string, data?: any): void {
    const timestamp = new Date().toISOString();
    const logLine = `[${timestamp}] 🔍 DEBUG: ${message}${data ? '\n' + JSON.stringify(data, null, 2) : ''}\n`;

    // 写入文件
    try {
      fs.appendFileSync(this.logFile, logLine);
    } catch (error) {
      console.error('Failed to write to log file:', error);
    }

    // 输出到控制台 - 使用console.debug
    console.debug(`🔍 DEBUG: ${message}`, data || '');
  }

  info(message: string, data?: any): void {
    const timestamp = new Date().toISOString();
    const logLine = `[${timestamp}] ℹ️ INFO: ${message}${data ? '\n' + JSON.stringify(data, null, 2) : ''}\n`;

    // 写入文件
    try {
      fs.appendFileSync(this.logFile, logLine);
    } catch (error) {
      console.error('Failed to write to log file:', error);
    }

    // 输出到控制台 - 使用console.log for info
    console.log(`ℹ️ INFO: ${message}`, data || '');
  }

  warn(message: string, data?: any): void {
    const timestamp = new Date().toISOString();
    const logLine = `[${timestamp}] ⚠️ WARN: ${message}${data ? '\n' + JSON.stringify(data, null, 2) : ''}\n`;

    // 写入文件
    try {
      fs.appendFileSync(this.logFile, logLine);
    } catch (error) {
      console.error('Failed to write to log file:', error);
    }

    // 输出到控制台 - 使用console.warn
    console.warn(`⚠️ WARN: ${message}`, data || '');
  }

  processEvent(eventType: string, data?: any): void {
    this.log(`🚨 PROCESS EVENT: ${eventType}`, data);
  }

  getLogFile(): string {
    return this.logFile;
  }
}

export const debugLogger = Logger.getInstance();