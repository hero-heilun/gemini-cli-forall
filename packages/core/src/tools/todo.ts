/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import fs from 'fs';
import path from 'path';
import { Config } from '../config/config.js';
import { BaseTool, ToolResult } from './tools.js';
import { getErrorMessage } from '../utils/errors.js';

/**
 * Interface for a Todo item
 */
export interface TodoItem {
  id: string;
  content: string;
  completed: boolean;
  priority: 'high' | 'medium' | 'low';
  created: string;
  updated?: string;
}

/**
 * Parameters for the Todo tool
 */
export interface TodoToolParams {
  /**
   * The action to perform: 'list', 'add', 'complete', 'update', or 'remove'
   */
  action: 'list' | 'add' | 'complete' | 'update' | 'remove';

  /**
   * The content of the todo item (required for 'add' and 'update')
   */
  content?: string;

  /**
   * The ID of the todo item (required for 'complete', 'update', and 'remove')
   */
  id?: string;

  /**
   * Priority level for the todo item (optional, defaults to 'medium')
   */
  priority?: 'high' | 'medium' | 'low';

  /**
   * List of todo items to add in batch (alternative to single content)
   */
  items?: Array<{
    content: string;
    priority?: 'high' | 'medium' | 'low';
  }>;
}

/**
 * Implementation of the Todo management tool
 */
export class TodoTool extends BaseTool<TodoToolParams, ToolResult> {
  static readonly Name: string = 'update_todos';
  private readonly todoFilePath: string;

  constructor(private readonly config: Config) {
    super(
      TodoTool.Name,
      'Update Todos',
      `Manages a todo list. Can list, add, complete, update, or remove todo items.
      
      This tool maintains a persistent todo list that can be used to track tasks and progress.`,
      {
        properties: {
          action: {
            description: 'The action to perform on the todo list',
            type: 'string',
            enum: ['list', 'add', 'complete', 'update', 'remove'],
          },
          content: {
            description: 'The content/description of the todo item',
            type: 'string',
          },
          id: {
            description: 'The ID of the todo item to modify',
            type: 'string',
          },
          priority: {
            description: 'Priority level of the todo item',
            type: 'string',
            enum: ['high', 'medium', 'low'],
          },
          items: {
            description: 'Batch add multiple todo items',
            type: 'array',
            items: {
              type: 'object',
              properties: {
                content: {
                  description: 'Todo item content',
                  type: 'string',
                },
                priority: {
                  description: 'Priority level',
                  type: 'string',
                  enum: ['high', 'medium', 'low'],
                },
              },
              required: ['content'],
            },
          },
        },
        required: ['action'],
        type: 'object',
      },
    );

    // Store todos in .gemini directory
    const geminiDir = path.join(process.cwd(), '.gemini');
    this.todoFilePath = path.join(geminiDir, 'todos.json');
    
    // Ensure .gemini directory exists
    if (!fs.existsSync(geminiDir)) {
      fs.mkdirSync(geminiDir, { recursive: true });
    }
  }

  /**
   * Load todos from file
   */
  private loadTodos(): TodoItem[] {
    try {
      if (!fs.existsSync(this.todoFilePath)) {
        return [];
      }
      const data = fs.readFileSync(this.todoFilePath, 'utf8');
      return JSON.parse(data) as TodoItem[];
    } catch (error) {
      console.warn('Failed to load todos, starting with empty list:', getErrorMessage(error));
      return [];
    }
  }

  /**
   * Save todos to file
   */
  private saveTodos(todos: TodoItem[]): void {
    try {
      fs.writeFileSync(this.todoFilePath, JSON.stringify(todos, null, 2), 'utf8');
    } catch (error) {
      throw new Error(`Failed to save todos: ${getErrorMessage(error)}`);
    }
  }

  /**
   * Generate a unique ID for a todo item
   */
  private generateId(): string {
    return Math.random().toString(36).substr(2, 9);
  }

  /**
   * Format todos for display
   */
  private formatTodos(todos: TodoItem[]): string {
    if (todos.length === 0) {
      return 'No todos found.';
    }

    const prioritySymbols = {
      high: '🔴',
      medium: '🟡', 
      low: '🟢',
    };

    const grouped = {
      high: todos.filter(t => t.priority === 'high'),
      medium: todos.filter(t => t.priority === 'medium'),
      low: todos.filter(t => t.priority === 'low'),
    };

    let output = '';
    
    for (const [priority, items] of Object.entries(grouped)) {
      if (items.length > 0) {
        output += `\n**${priority.toUpperCase()} PRIORITY** ${prioritySymbols[priority as keyof typeof prioritySymbols]}\n`;
        items.forEach(todo => {
          const status = todo.completed ? '☒' : '☐';
          output += `  ${status} ${todo.content}\n`;
          output += `    *ID: ${todo.id} | Created: ${new Date(todo.created).toLocaleDateString()}*\n`;
        });
      }
    }

    return output.trim();
  }

  validateToolParams(params: TodoToolParams): string | null {
    // Basic parameter validation
    if (!params.action) {
      return 'Action is required';
    }

    const validActions = ['list', 'add', 'complete', 'update', 'remove'];
    if (!validActions.includes(params.action)) {
      return `Invalid action. Must be one of: ${validActions.join(', ')}`;
    }

    // Additional validation based on action
    if (params.action === 'add') {
      if (!params.content && !params.items) {
        return 'Content or items are required for add action';
      }
      if (params.items && params.items.some(item => !item.content?.trim())) {
        return 'All items must have non-empty content';
      }
    }

    if (['complete', 'update', 'remove'].includes(params.action) && !params.id) {
      return `ID is required for ${params.action} action`;
    }

    if (params.action === 'update' && !params.content) {
      return 'Content is required for update action';
    }

    return null;
  }

  async execute(params: TodoToolParams, _signal: AbortSignal): Promise<ToolResult> {
    try {
      const validationError = this.validateToolParams(params);
      if (validationError) {
        return {
          llmContent: `Error: ${validationError}`,
          returnDisplay: `❌ Invalid parameters: ${validationError}`,
        };
      }

      const todos = this.loadTodos();
      let result = '';

      switch (params.action) {
        case 'list':
          result = this.formatTodos(todos);
          break;

        case 'add':
          if (params.items) {
            // Batch add
            const newTodos = params.items.map(item => ({
              id: this.generateId(),
              content: item.content.trim(),
              completed: false,
              priority: item.priority || 'medium',
              created: new Date().toISOString(),
            }));
            todos.push(...newTodos);
            result = `Added ${newTodos.length} todo items:\n${newTodos.map(t => `- ${t.content}`).join('\n')}`;
          } else if (params.content) {
            // Single add
            const newTodo: TodoItem = {
              id: this.generateId(),
              content: params.content.trim(),
              completed: false,
              priority: params.priority || 'medium',
              created: new Date().toISOString(),
            };
            todos.push(newTodo);
            result = `Added todo: "${newTodo.content}" (ID: ${newTodo.id})`;
          }
          break;

        case 'complete': {
          const todoToComplete = todos.find(t => t.id === params.id);
          if (!todoToComplete) {
            throw new Error(`Todo with ID "${params.id}" not found`);
          }
          todoToComplete.completed = true;
          todoToComplete.updated = new Date().toISOString();
          result = `Marked as completed: "${todoToComplete.content}"`;
          break;
        }

        case 'update': {
          const todoToUpdate = todos.find(t => t.id === params.id);
          if (!todoToUpdate) {
            throw new Error(`Todo with ID "${params.id}" not found`);
          }
          const oldContent = todoToUpdate.content;
          todoToUpdate.content = params.content!.trim();
          if (params.priority) {
            todoToUpdate.priority = params.priority;
          }
          todoToUpdate.updated = new Date().toISOString();
          result = `Updated todo: "${oldContent}" → "${todoToUpdate.content}"`;
          break;
        }

        case 'remove': {
          const todoIndex = todos.findIndex(t => t.id === params.id);
          if (todoIndex === -1) {
            throw new Error(`Todo with ID "${params.id}" not found`);
          }
          const removedTodo = todos.splice(todoIndex, 1)[0];
          result = `Removed todo: "${removedTodo.content}"`;
          break;
        }

        default:
          throw new Error(`Unknown action: ${params.action}`);
      }

      this.saveTodos(todos);

      return {
        llmContent: result,
        returnDisplay: result,
      };
    } catch (error) {
      const errorMessage = getErrorMessage(error);
      return {
        llmContent: `Error: ${errorMessage}`,
        returnDisplay: `❌ Todo operation failed: ${errorMessage}`,
      };
    }
  }

  getDescription(params: TodoToolParams): string {
    switch (params.action) {
      case 'list':
        return 'Listing all todo items';
      case 'add':
        if (params.items) {
          return `Adding ${params.items.length} todo items`;
        }
        return `Adding todo: "${params.content}"`;
      case 'complete':
        return `Marking todo as completed (ID: ${params.id})`;
      case 'update':
        return `Updating todo (ID: ${params.id})`;
      case 'remove':
        return `Removing todo (ID: ${params.id})`;
      default:
        return 'Managing todo list';
    }
  }
}