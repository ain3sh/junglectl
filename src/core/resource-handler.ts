/**
 * Generic Resource Handler
 * Handles listing and displaying any resource type dynamically
 */

import { MCPJungleExecutor } from './executor.js';
import { OutputParser } from './parser.js';
import { Formatters } from '../ui/formatters.js';
import { withSpinner } from '../ui/spinners.js';
import chalk from 'chalk';

/**
 * Generic handler for listing any resource type
 */
export class ResourceHandler {
  private executor: MCPJungleExecutor;

  constructor(registryUrl?: string) {
    this.executor = new MCPJungleExecutor(registryUrl);
  }

  /**
   * List any resource type generically
   */
  async listResource(
    resourceType: string,
    options: {
      serverFilter?: string;
      registryUrl?: string;
    } = {}
  ): Promise<void> {
    // Build command args
    const args = ['list', resourceType];
    if (options.serverFilter) {
      args.push('--server', options.serverFilter);
    }

    // Fetch data with spinner
    const data = await withSpinner(
      options.serverFilter
        ? `Fetching ${resourceType} for ${options.serverFilter}...`
        : `Fetching ${resourceType}...`,
      async () => {
        // Create executor with registry URL if provided (legacy MCP support)
        const exec = options.registryUrl ? new MCPJungleExecutor(options.registryUrl) : this.executor;
        const result = await exec.execute(args);
        
        // Try specialized parser first, fall back to generic
        return this.parseResourceOutput(resourceType, result.stdout);
      },
      { successMessage: `${this.capitalize(resourceType)} loaded` }
    );

    // Display results
    this.displayResource(resourceType, data);
  }

  /**
   * Parse resource output - try specialized parser, fall back to generic
   */
  private parseResourceOutput(resourceType: string, output: string): any[] {
    // Try specialized parsers for known types
    switch (resourceType) {
      case 'servers':
        return OutputParser.parseServers(output);
      case 'tools':
        return OutputParser.parseTools(output);
      case 'groups':
        return OutputParser.parseGroups(output);
      case 'prompts':
        return OutputParser.parsePrompts(output);
      default:
        // Use generic table parser for unknown types
        return OutputParser.parseGenericTable(output);
    }
  }

  /**
   * Display resource data appropriately
   */
  private displayResource(resourceType: string, data: any[]): void {
    if (data.length === 0) {
      console.log(chalk.yellow(`\nNo ${resourceType} available\n`));
      return;
    }

    // Try specialized formatter first
    const formattedTable = this.formatResource(resourceType, data);
    console.log('\n' + formattedTable + '\n');

    // Show count
    console.log(chalk.gray(`Total: ${data.length} ${resourceType}\n`));
  }

  /**
   * Format resource for display - use specialized formatter or generic table
   */
  private formatResource(resourceType: string, data: any[]): string {
    // Use specialized formatters for known types
    switch (resourceType) {
      case 'servers':
        return Formatters.serversTable(data);
      case 'tools':
        return Formatters.toolsTable(data);
      case 'groups':
        return Formatters.groupsTable(data);
      case 'prompts':
        return Formatters.promptsTable(data);
      default:
        // Use generic table for unknown types
        return Formatters.genericTable(data);
    }
  }

  /**
   * Capitalize first letter
   */
  private capitalize(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }
}
