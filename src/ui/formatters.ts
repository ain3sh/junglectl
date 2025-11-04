/**
 * Output Formatters
 * Pretty printing for tables, lists, and status
 */

import Table from 'cli-table3';
import chalk from 'chalk';
import type { MCPServer, MCPTool, ToolGroup, MCPPrompt } from '../types/mcpjungle.js';

export class Formatters {
  /**
   * Format servers as a table
   */
  static serversTable(servers: MCPServer[]): string {
    if (servers.length === 0) {
      return chalk.yellow('No servers registered');
    }

    const table = new Table({
      head: [
        chalk.cyan('Name'),
        chalk.cyan('Transport'),
        chalk.cyan('URL/Command'),
        chalk.cyan('Status'),
      ],
      style: {
        head: [],
        border: ['gray'],
      },
      colWidths: [20, 18, 40, 12],
      wordWrap: true,
    });

    for (const server of servers) {
      const urlOrCommand = server.url || 
        (server.command ? `${server.command} ${(server.args || []).join(' ')}` : '-');
      
      const status = server.enabled
        ? chalk.green('✓ Enabled')
        : chalk.red('✗ Disabled');

      table.push([
        chalk.white(server.name),
        chalk.gray(server.transport),
        chalk.gray(urlOrCommand.slice(0, 38) + (urlOrCommand.length > 38 ? '...' : '')),
        status,
      ]);
    }

    return table.toString();
  }

  /**
   * Format tools as a table
   */
  static toolsTable(tools: MCPTool[]): string {
    if (tools.length === 0) {
      return chalk.yellow('No tools available');
    }

    const table = new Table({
      head: [
        chalk.cyan('Tool Name'),
        chalk.cyan('Server'),
        chalk.cyan('Description'),
        chalk.cyan('Status'),
      ],
      style: {
        head: [],
        border: ['gray'],
      },
      colWidths: [30, 18, 40, 12],
      wordWrap: true,
    });

    for (const tool of tools) {
      const status = tool.enabled
        ? chalk.green('✓ On')
        : chalk.red('✗ Off');

      const desc = tool.description || '-';

      table.push([
        chalk.white(tool.canonicalName),
        chalk.gray(tool.serverName),
        chalk.gray(desc.slice(0, 38) + (desc.length > 38 ? '...' : '')),
        status,
      ]);
    }

    return table.toString();
  }

  /**
   * Format tool groups as a table
   */
  static groupsTable(groups: ToolGroup[]): string {
    if (groups.length === 0) {
      return chalk.yellow('No tool groups defined');
    }

    const table = new Table({
      head: [
        chalk.cyan('Group Name'),
        chalk.cyan('Description'),
        chalk.cyan('Endpoint'),
      ],
      style: {
        head: [],
        border: ['gray'],
      },
      colWidths: [25, 40, 35],
      wordWrap: true,
    });

    for (const group of groups) {
      const desc = group.description || '-';
      const endpoint = group.endpoint || '-';

      table.push([
        chalk.white(group.name),
        chalk.gray(desc.slice(0, 38) + (desc.length > 38 ? '...' : '')),
        chalk.gray(endpoint.slice(0, 33) + (endpoint.length > 33 ? '...' : '')),
      ]);
    }

    return table.toString();
  }

  /**
   * Format prompts as a table
   */
  static promptsTable(prompts: MCPPrompt[]): string {
    if (prompts.length === 0) {
      return chalk.yellow('No prompts available');
    }

    const table = new Table({
      head: [
        chalk.cyan('Prompt Name'),
        chalk.cyan('Server'),
        chalk.cyan('Description'),
      ],
      style: {
        head: [],
        border: ['gray'],
      },
      colWidths: [35, 20, 45],
      wordWrap: true,
    });

    for (const prompt of prompts) {
      const desc = prompt.description || '-';

      table.push([
        chalk.white(prompt.canonicalName),
        chalk.gray(prompt.serverName),
        chalk.gray(desc),
      ]);
    }

    return table.toString();
  }

  /**
   * Format JSON output with syntax highlighting
   */
  static prettyJson(obj: any): string {
    const json = JSON.stringify(obj, null, 2);
    
    return json
      .replace(/"([^"]+)":/g, chalk.cyan('"$1"') + ':')
      .replace(/: "([^"]+)"/g, ': ' + chalk.green('"$1"'))
      .replace(/: (\d+)/g, ': ' + chalk.yellow('$1'))
      .replace(/: (true|false|null)/g, ': ' + chalk.magenta('$1'));
  }

  /**
   * Format header/banner
   */
  static header(title: string): string {
    const width = 60;
    const padding = Math.max(0, Math.floor((width - title.length) / 2));
    
    return '\n' +
      chalk.cyan('┌' + '─'.repeat(width) + '┐') + '\n' +
      chalk.cyan('│') + ' '.repeat(padding) + chalk.bold.white(title) + 
      ' '.repeat(width - padding - title.length) + chalk.cyan('│') + '\n' +
      chalk.cyan('└' + '─'.repeat(width) + '┘') + '\n';
  }

  /**
   * Format success message
   */
  static success(message: string): string {
    return chalk.green('✓ ') + chalk.white(message);
  }

  /**
   * Format error message
   */
  static error(message: string): string {
    return chalk.red('✗ ') + chalk.white(message);
  }

  /**
   * Format warning message
   */
  static warning(message: string): string {
    return chalk.yellow('⚠ ') + chalk.white(message);
  }

  /**
   * Format info message
   */
  static info(message: string): string {
    return chalk.blue('ℹ ') + chalk.white(message);
  }

  /**
   * Format status bar
   */
  static statusBar(status: {
    connected: boolean;
    url: string;
    serverCount?: number;
    toolCount?: number;
  }): string {
    const statusIcon = status.connected ? chalk.green('✓') : chalk.red('✗');
    const statusText = status.connected ? chalk.green('Connected') : chalk.red('Disconnected');
    
    const stats = status.connected && status.serverCount !== undefined
      ? chalk.gray(` | ${status.serverCount} servers, ${status.toolCount || 0} tools`)
      : '';

    return chalk.gray('Server: ') + chalk.cyan(status.url) + 
           chalk.gray(' | Status: ') + statusIcon + ' ' + statusText + stats;
  }

  /**
   * Truncate text with ellipsis
   */
  static truncate(text: string, maxLength: number): string {
    if (text.length <= maxLength) return text;
    return text.slice(0, maxLength - 3) + '...';
  }

  /**
   * Generic table formatter - works with any data structure
   */
  static genericTable(data: Record<string, any>[]): string {
    if (data.length === 0) {
      return chalk.yellow('No data available');
    }

    // Extract all unique keys from all objects
    const allKeys = new Set<string>();
    for (const item of data) {
      Object.keys(item).forEach(key => allKeys.add(key));
    }

    const headers = Array.from(allKeys);

    if (headers.length === 0) {
      return chalk.yellow('No data available');
    }

    // Create table
    const table = new Table({
      head: headers.map(h => chalk.cyan(this.formatHeaderName(h))),
      style: {
        head: [],
        border: ['gray'],
      },
      wordWrap: true,
    });

    // Add rows
    for (const item of data) {
      const row = headers.map(key => {
        const value = item[key];
        if (value === undefined || value === null) return chalk.gray('-');
        
        // Format based on value type
        const strValue = String(value);
        
        // Highlight status-like fields
        if (key.toLowerCase().includes('status') || key.toLowerCase().includes('enabled')) {
          return this.formatStatusValue(strValue);
        }
        
        return chalk.white(strValue.slice(0, 50) + (strValue.length > 50 ? '...' : ''));
      });
      
      table.push(row);
    }

    return table.toString();
  }

  /**
   * Format header name (convert snake_case to Title Case)
   */
  private static formatHeaderName(header: string): string {
    return header
      .split(/[_-]/)
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  /**
   * Format status-like values with colors
   */
  private static formatStatusValue(value: string): string {
    const lower = value.toLowerCase();
    
    if (lower.includes('enable') || lower.includes('✓') || lower === 'true' || lower === 'on') {
      return chalk.green(value);
    } else if (lower.includes('disable') || lower.includes('✗') || lower === 'false' || lower === 'off') {
      return chalk.red(value);
    } else if (lower.includes('unknown') || lower.includes('pending')) {
      return chalk.yellow(value);
    }
    
    return chalk.white(value);
  }
}
