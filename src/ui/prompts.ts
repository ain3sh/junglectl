/**
 * Reusable Interactive Prompts
 * Autocomplete, selection, and input builders
 */

import { input, select, confirm, checkbox } from '@inquirer/prompts';
import search from '@inquirer/search';
import { cache } from '../core/cache.js';
import { MCPJungleExecutor } from '../core/executor.js';
import { OutputParser } from '../core/parser.js';
import type { TransportType } from '../types/mcpjungle.js';
import chalk from 'chalk';

const executor = new MCPJungleExecutor();

export class Prompts {
  /**
   * Server selection with autocomplete search
   */
  static async selectServer(
    message: string = 'Select a server',
    registryUrl?: string
  ): Promise<string> {
    // Create executor with registry URL if provided (legacy MCP support)
    const exec = registryUrl ? new MCPJungleExecutor(registryUrl) : executor;
    
    const servers = await cache.get('servers', async () => {
      try {
        const result = await exec.execute(['list', 'servers']);
        return OutputParser.parseServers(result.stdout);
      } catch {
        return [];
      }
    });

    if (servers.length === 0) {
      throw new Error('No servers registered. Please register a server first.');
    }

    return search({
      message,
      source: async (input) => {
        const filtered = input
          ? servers.filter(s =>
              s.name.toLowerCase().includes(input.toLowerCase()) ||
              (s.description && s.description.toLowerCase().includes(input.toLowerCase()))
            )
          : servers;

        return filtered.map(s => ({
          value: s.name,
          name: s.name,
          description: s.description || `${s.transport} server`,
        }));
      },
    });
  }

  /**
   * Tool selection with autocomplete search
   */
  static async selectTool(
    message: string = 'Select a tool',
    serverFilter?: string,
    registryUrl?: string
  ): Promise<string> {
    // Create executor with registry URL if provided (legacy MCP support)
    const exec = registryUrl ? new MCPJungleExecutor(registryUrl) : executor;
    
    const cacheKey = serverFilter ? `tools_${serverFilter}` : 'tools';

    const tools = await cache.get(cacheKey, async () => {
      try {
        const args = ['list', 'tools'];
        if (serverFilter) args.push('--server', serverFilter);

        const result = await exec.execute(args);
        return OutputParser.parseTools(result.stdout);
      } catch {
        return [];
      }
    });

    if (tools.length === 0) {
      throw new Error(
        serverFilter
          ? `No tools found for server "${serverFilter}"`
          : 'No tools available'
      );
    }

    return search({
      message,
      source: async (input) => {
        const filtered = input
          ? tools.filter(t =>
              t.canonicalName.toLowerCase().includes(input.toLowerCase()) ||
              (t.description && t.description.toLowerCase().includes(input.toLowerCase()))
            )
          : tools;

        return filtered.map(t => ({
          value: t.canonicalName,
          name: t.canonicalName,
          description: t.description || `Tool from ${t.serverName}`,
        }));
      },
    });
  }

  /**
   * Transport type selection
   */
  static async selectTransport(): Promise<TransportType> {
    return select({
      message: 'Select transport type',
      choices: [
        {
          value: 'streamable_http' as const,
          name: chalk.cyan('🌐 Streamable HTTP'),
          description: 'For HTTP-based MCP servers (remote or local HTTP endpoints)',
        },
        {
          value: 'stdio' as const,
          name: chalk.green('🖥️  STDIO'),
          description: 'For npx/uvx-based servers (runs as subprocess)',
        },
        {
          value: 'sse' as const,
          name: chalk.yellow('📡 SSE (Experimental)'),
          description: 'Server-sent events transport (not fully supported)',
        },
      ],
    });
  }

  /**
   * Multi-select tools for group creation
   */
  static async selectMultipleTools(
    message: string = 'Select tools to include',
    registryUrl?: string
  ): Promise<string[]> {
    // Create executor with registry URL if provided (legacy MCP support)
    const exec = registryUrl ? new MCPJungleExecutor(registryUrl) : executor;
    
    const tools = await cache.get('tools', async () => {
      try {
        const result = await exec.execute(['list', 'tools']);
        return OutputParser.parseTools(result.stdout);
      } catch {
        return [];
      }
    });

    if (tools.length === 0) {
      return [];
    }

    const result = await checkbox({
      message: `${message} (${tools.length} available)`,
      choices: tools.map(t => ({
        value: t.canonicalName,
        name: t.canonicalName,
        description: t.description,
      })),
      pageSize: 15,
    });
    
    return result;
  }

  /**
   * Multi-select servers for group creation
   */
  static async selectMultipleServers(
    message: string = 'Select servers to include',
    registryUrl?: string
  ): Promise<string[]> {
    // Create executor with registry URL if provided (legacy MCP support)
    const exec = registryUrl ? new MCPJungleExecutor(registryUrl) : executor;
    
    const servers = await cache.get('servers', async () => {
      try {
        const result = await exec.execute(['list', 'servers']);
        return OutputParser.parseServers(result.stdout);
      } catch {
        return [];
      }
    });

    if (servers.length === 0) {
      return [];
    }

    const result = await checkbox({
      message: `${message} (${servers.length} available)`,
      choices: servers.map(s => ({
        value: s.name,
        name: s.name,
        description: s.description,
      })),
      pageSize: 15,
    });
    
    return result;
  }

  /**
   * Simple text input with validation
   */
  static async textInput(
    message: string,
    options: {
      default?: string;
      required?: boolean;
      validate?: (value: string) => boolean | string;
    } = {}
  ): Promise<string> {
    return input({
      message,
      default: options.default,
      validate: (value) => {
        if (options.required && !value.trim()) {
          return 'This field is required';
        }
        if (options.validate) {
          return options.validate(value);
        }
        return true;
      },
    });
  }

  /**
   * Yes/no confirmation
   */
  static async confirm(message: string, defaultValue: boolean = true): Promise<boolean> {
    return confirm({
      message,
      default: defaultValue,
    });
  }

  /**
   * Generic select from choices
   */
  static async select<T extends string>(
    message: string,
    choices: Array<{ value: T; name: string; description?: string }>
  ): Promise<T> {
    return select({
      message,
      choices,
    });
  }

  /**
   * Group selection with autocomplete
   */
  static async selectGroup(
    message: string = 'Select a tool group',
    registryUrl?: string
  ): Promise<string> {
    // Create executor with registry URL if provided (legacy MCP support)
    const exec = registryUrl ? new MCPJungleExecutor(registryUrl) : executor;
    
    const groups = await cache.get('groups', async () => {
      try {
        const result = await exec.execute(['list', 'groups']);
        return OutputParser.parseGroups(result.stdout);
      } catch {
        return [];
      }
    });

    if (groups.length === 0) {
      throw new Error('No tool groups defined');
    }

    return search({
      message,
      source: async (input) => {
        const filtered = input
          ? groups.filter(g =>
              g.name.toLowerCase().includes(input.toLowerCase()) ||
              (g.description && g.description.toLowerCase().includes(input.toLowerCase()))
            )
          : groups;

        return filtered.map(g => ({
          value: g.name,
          name: g.name,
          description: g.description || 'Tool group',
        }));
      },
    });
  }

  /**
   * Prompt selection with autocomplete
   */
  static async selectPrompt(
    message: string = 'Select a prompt',
    serverFilter?: string,
    registryUrl?: string
  ): Promise<string> {
    // Create executor with registry URL if provided (legacy MCP support)
    const exec = registryUrl ? new MCPJungleExecutor(registryUrl) : executor;
    
    const cacheKey = serverFilter ? `prompts_${serverFilter}` : 'prompts';

    const prompts = await cache.get(cacheKey, async () => {
      try {
        const args = ['list', 'prompts'];
        if (serverFilter) args.push('--server', serverFilter);

        const result = await exec.execute(args);
        return OutputParser.parsePrompts(result.stdout);
      } catch {
        return [];
      }
    });

    if (prompts.length === 0) {
      throw new Error(
        serverFilter
          ? `No prompts found for server "${serverFilter}"`
          : 'No prompts available'
      );
    }

    return search({
      message,
      source: async (input) => {
        const filtered = input
          ? prompts.filter(p =>
              p.canonicalName.toLowerCase().includes(input.toLowerCase()) ||
              (p.description && p.description.toLowerCase().includes(input.toLowerCase()))
            )
          : prompts;

        return filtered.map(p => ({
          value: p.canonicalName,
          name: p.canonicalName,
          description: p.description || `Prompt from ${p.serverName}`,
        }));
      },
    });
  }
}
