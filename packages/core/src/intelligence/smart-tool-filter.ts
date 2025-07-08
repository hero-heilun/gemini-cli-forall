/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Smart Tool Filter - Intelligently decides which tools to provide based on user input
 * Mimics Gemini's selective tool provision strategy
 */

export interface UserInputAnalysis {
  isComplete: boolean;        // 是否包含足够信息执行任务
  isSpecific: boolean;        // 是否足够具体
  requiresMoreInfo: boolean;  // 是否需要更多信息
  suggestedToolCategories: ToolCategory[]; // 建议的工具类别
  confidence: number;         // 分析置信度 (0-1)
}

export enum ToolCategory {
  FILE_OPERATIONS = 'file_operations',
  DATABASE_OPERATIONS = 'database_operations',
  NETWORK_OPERATIONS = 'network_operations', 
  SHELL_OPERATIONS = 'shell_operations',
  SEARCH_OPERATIONS = 'search_operations',
  MEMORY_OPERATIONS = 'memory_operations',
  DEVELOPMENT_OPERATIONS = 'development_operations'
}

export interface ToolFilterRule {
  patterns: string[];           // 匹配模式
  category: ToolCategory;       // 工具类别
  requiresSpecificity: boolean; // 是否需要具体信息
  minInfoLevel: number;         // 最低信息要求 (1-5)
}

export class SmartToolFilter {
  private readonly filterRules: ToolFilterRule[] = [
    // 数据库操作 - 需要具体的数据库信息
    {
      patterns: ['数据库', '表', 'SQL', 'mysql', 'sqlite', 'postgres', 'database', 'tables', '查询'],
      category: ToolCategory.DATABASE_OPERATIONS,
      requiresSpecificity: true,
      minInfoLevel: 3 // 需要数据库类型、连接信息等
    },
    
    // 文件操作 - 需要具体的文件路径
    {
      patterns: ['文件', '目录', '文件夹', '读取', '写入', '列出', 'file', 'directory', 'folder', 'read', 'write', 'list'],
      category: ToolCategory.FILE_OPERATIONS,
      requiresSpecificity: true,
      minInfoLevel: 2 // 需要文件路径
    },
    
    // 网络操作 - 需要URL或网站信息
    {
      patterns: ['网站', 'URL', '下载', '获取', 'website', 'fetch', 'download', 'http'],
      category: ToolCategory.NETWORK_OPERATIONS,
      requiresSpecificity: true,
      minInfoLevel: 3 // 需要URL
    },
    
    // Shell操作 - 相对灵活，但需要明确的命令意图
    {
      patterns: ['执行', '运行', '命令', 'shell', 'bash', 'command', 'execute', 'run'],
      category: ToolCategory.SHELL_OPERATIONS,
      requiresSpecificity: false,
      minInfoLevel: 2
    },
    
    // 搜索操作 - 相对灵活
    {
      patterns: ['搜索', '查找', '寻找', 'search', 'find', 'look for'],
      category: ToolCategory.SEARCH_OPERATIONS,
      requiresSpecificity: false,
      minInfoLevel: 2
    },
    
    // 内存/记忆操作
    {
      patterns: ['记住', '保存', '记录', 'remember', 'save', 'record', 'memory'],
      category: ToolCategory.MEMORY_OPERATIONS,
      requiresSpecificity: false,
      minInfoLevel: 2
    }
  ];

  /**
   * 分析用户输入，判断是否应该提供工具
   */
  analyzeUserInput(input: string): UserInputAnalysis {
    const normalizedInput = input.toLowerCase().trim();
    
    // 基础信息分析
    const wordCount = normalizedInput.split(/\s+/).length;
    const hasSpecificTerms = this.hasSpecificTerms(normalizedInput);
    const matchedCategories = this.getMatchedCategories(normalizedInput);
    const informationLevel = this.assessInformationLevel(normalizedInput);
    
    // 判断是否完整和具体
    const isComplete = this.isInputComplete(normalizedInput, matchedCategories, informationLevel);
    const isSpecific = hasSpecificTerms && informationLevel >= 3;
    const requiresMoreInfo = matchedCategories.length > 0 && !isComplete;
    
    // 计算置信度
    const confidence = this.calculateConfidence(wordCount, hasSpecificTerms, matchedCategories.length, informationLevel);
    
    return {
      isComplete,
      isSpecific,
      requiresMoreInfo,
      suggestedToolCategories: matchedCategories, // 总是返回匹配的类别
      confidence
    };
  }

  /**
   * 根据分析结果过滤工具
   */
  filterTools(tools: any[], analysis: UserInputAnalysis): any[] {
    // 如果需要更多信息，不提供任何工具，让AI自然回复
    if (analysis.requiresMoreInfo || !analysis.isComplete) {
      return [];
    }
    
    // 如果没有匹配的类别，提供基础工具
    if (analysis.suggestedToolCategories.length === 0) {
      return this.getBasicTools(tools);
    }
    
    // 根据建议的类别过滤工具
    return tools.filter(tool => this.isToolInCategories(tool, analysis.suggestedToolCategories));
  }

  private hasSpecificTerms(input: string): boolean {
    // 检查是否包含具体的名词、路径、URL等
    const specificPatterns = [
      /[a-zA-Z]:\\.+/,                    // Windows路径
      /\/[a-zA-Z0-9\/\-_.]+/,             // Unix路径
      /https?:\/\/.+/,                    // URL
      /\w+\.\w{2,}/,                      // 域名或文件名
      /[a-zA-Z0-9_]+\.db/,                // 数据库文件
      /[a-zA-Z0-9_]+\.sql/,               // SQL文件
      /localhost:\d+/,                    // localhost端口
      /\d+\.\d+\.\d+\.\d+/,              // IP地址
      /(mysql|sqlite|postgres).*\w/,     // 数据库类型加其他信息
      /(用户|密码|host|port|database).*\w/, // 数据库连接参数
    ];
    
    return specificPatterns.some(pattern => pattern.test(input));
  }

  private getMatchedCategories(input: string): ToolCategory[] {
    const matched: ToolCategory[] = [];
    
    for (const rule of this.filterRules) {
      if (rule.patterns.some(pattern => input.includes(pattern))) {
        matched.push(rule.category);
      }
    }
    
    return [...new Set(matched)]; // 去重
  }

  private assessInformationLevel(input: string): number {
    let level = 1; // 基础级别
    
    // 检查信息丰富度的各种指标
    if (input.length > 50) level++;           // 较长输入
    if (this.hasSpecificTerms(input)) level++; // 包含具体术语
    if (/\d+/.test(input)) level++;           // 包含数字
    if (input.split(/\s+/).length > 8) level++; // 词汇丰富
    
    return Math.min(level, 5); // 最高5级
  }

  private isInputComplete(input: string, categories: ToolCategory[], infoLevel: number): boolean {
    // 如果没有匹配任何工具类别，认为是一般性问题，可以自然回复
    if (categories.length === 0) {
      return false;
    }
    
    // 检查每个匹配的类别是否有足够信息
    for (const category of categories) {
      const rule = this.filterRules.find(r => r.category === category);
      if (rule && rule.requiresSpecificity && infoLevel < rule.minInfoLevel) {
        return false; // 需要具体信息但不够具体
      }
    }
    
    return true;
  }

  private calculateConfidence(wordCount: number, hasSpecific: boolean, categoryCount: number, infoLevel: number): number {
    let confidence = 0.5; // 基础置信度
    
    if (wordCount > 3) confidence += 0.1;
    if (hasSpecific) confidence += 0.2;
    if (categoryCount > 0) confidence += 0.1 * categoryCount;
    if (infoLevel >= 3) confidence += 0.1;
    
    return Math.min(confidence, 1.0);
  }

  private getBasicTools(tools: any[]): any[] {
    // 提供一些基础工具：搜索、内存、基本文件操作
    const basicToolNames = ['web_search', 'memory', 'ls', 'grep'];
    return tools.filter(tool => basicToolNames.includes(tool.name));
  }

  private isToolInCategories(tool: any, categories: ToolCategory[]): boolean {
    // 工具名称到类别的映射
    const toolCategoryMap: Record<string, ToolCategory[]> = {
      // 文件操作
      'ls': [ToolCategory.FILE_OPERATIONS],
      'read_file': [ToolCategory.FILE_OPERATIONS],
      'write_file': [ToolCategory.FILE_OPERATIONS],
      'edit': [ToolCategory.FILE_OPERATIONS],
      'glob': [ToolCategory.FILE_OPERATIONS],
      'read_many_files': [ToolCategory.FILE_OPERATIONS],
      
      // Shell操作 - 可以处理多种类型的任务
      'shell': [
        ToolCategory.SHELL_OPERATIONS, 
        ToolCategory.DATABASE_OPERATIONS  // shell可以执行数据库命令
      ],
      
      // 网络操作
      'web_fetch': [ToolCategory.NETWORK_OPERATIONS],
      'web_search': [ToolCategory.SEARCH_OPERATIONS],
      
      // 搜索操作
      'grep': [ToolCategory.SEARCH_OPERATIONS],
      
      // 内存操作
      'memory': [ToolCategory.MEMORY_OPERATIONS],
      
      // 开发工具
      'update_todos': [ToolCategory.DEVELOPMENT_OPERATIONS],
    };

    const toolCategories = toolCategoryMap[tool.name] || [];
    return toolCategories.some(toolCategory => categories.includes(toolCategory));
  }
}