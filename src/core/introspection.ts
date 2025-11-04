/**
 * CLI Introspection System
 * Dynamically discovers MCPJungle's command structure by parsing help output
 */

import { MCPJungleExecutor } from './executor.js';

export interface Command {
  name: string;
  description: string;
  category: 'basic' | 'advanced';
  hasSubcommands?: boolean;
}

export interface Subcommand {
  name: string;
  description: string;
}

export interface Flag {
  name: string;
  shorthand?: string;
  description: string;
  type: 'string' | 'boolean';
  default?: string;
}

export interface CommandStructure {
  commands: Command[];
  subcommands: Map<string, Subcommand[]>;
  timestamp: number;
}

/**
 * CLI Introspection - discovers MCPJungle's command structure
 */
export class CLIIntrospector {
  private cache: CommandStructure | null = null;
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes
  private executor: MCPJungleExecutor;

  constructor(registryUrl?: string) {
    this.executor = new MCPJungleExecutor(registryUrl);
  }

  /**
   * Get command structure (cached)
   */
  async getCommandStructure(): Promise<CommandStructure> {
    // Return cached if valid
    if (this.cache && Date.now() - this.cache.timestamp < this.CACHE_TTL) {
      return this.cache;
    }

    // Discover fresh
    const commands = await this.discoverCommands();
    const subcommands = new Map<string, Subcommand[]>();

    // Discover subcommands for commands that have them
    for (const cmd of commands) {
      if (this.likelyHasSubcommands(cmd.name)) {
        try {
          const subs = await this.discoverSubcommands(cmd.name);
          if (subs.length > 0) {
            subcommands.set(cmd.name, subs);
            cmd.hasSubcommands = true;
          }
        } catch {
          // Command might not have subcommands, that's ok
        }
      }
    }

    this.cache = {
      commands,
      subcommands,
      timestamp: Date.now(),
    };

    return this.cache;
  }

  /**
   * Discover all top-level commands from mcpjungle --help
   */
  private async discoverCommands(): Promise<Command[]> {
    try {
      const result = await this.executor.execute(['--help'], { timeout: 5000 });
      return this.parseHelpOutput(result.stdout);
    } catch (error) {
      // Fallback to empty if help fails
      return [];
    }
  }

  /**
   * Discover subcommands for a specific command
   */
  private async discoverSubcommands(command: string): Promise<Subcommand[]> {
    try {
      const result = await this.executor.execute([command, '--help'], { timeout: 5000 });
      return this.parseSubcommandOutput(result.stdout);
    } catch {
      return [];
    }
  }

  /**
   * Parse mcpjungle --help output
   */
  private parseHelpOutput(output: string): Command[] {
    const commands: Command[] = [];

    // Parse "Basic Commands:" section
    const basicMatch = output.match(/Basic Commands:(.*?)(?=Advanced Commands:|Flags:|$)/s);
    if (basicMatch && basicMatch[1]) {
      const basicCommands = this.extractCommandsList(basicMatch[1], 'basic');
      commands.push(...basicCommands);
    }

    // Parse "Advanced Commands:" section
    const advancedMatch = output.match(/Advanced Commands:(.*?)(?=Flags:|$)/s);
    if (advancedMatch && advancedMatch[1]) {
      const advancedCommands = this.extractCommandsList(advancedMatch[1], 'advanced');
      commands.push(...advancedCommands);
    }

    return commands;
  }

  /**
   * Parse "Available Commands:" section for subcommands
   */
  private parseSubcommandOutput(output: string): Subcommand[] {
    const subcommands: Subcommand[] = [];

    const match = output.match(/Available Commands:(.*?)(?=Flags:|$)/s);
    if (!match || !match[1]) return [];

    const lines = match[1].trim().split('\n');

    for (const line of lines) {
      // Match pattern: "  command-name    Description text"
      const cmdMatch = line.match(/^\s+(\S+)\s{2,}(.+)$/);
      if (cmdMatch && cmdMatch[1] && cmdMatch[2]) {
        subcommands.push({
          name: cmdMatch[1],
          description: cmdMatch[2].trim(),
        });
      }
    }

    return subcommands;
  }

  /**
   * Extract commands from help section text
   */
  private extractCommandsList(text: string, category: 'basic' | 'advanced'): Command[] {
    const lines = text.trim().split('\n');
    const commands: Command[] = [];

    for (const line of lines) {
      // Match pattern: "  command-name    Description text"
      const match = line.match(/^\s+(\S+)\s{2,}(.+)$/);
      if (match && match[1] && match[2]) {
        commands.push({
          name: match[1],
          description: match[2].trim(),
          category,
        });
      }
    }

    return commands;
  }

  /**
   * Predict if command likely has subcommands based on name
   */
  private likelyHasSubcommands(name: string): boolean {
    // Commands that typically have subcommands
    const knownParents = ['list', 'get', 'create', 'delete', 'disable', 'enable', 'update'];
    return knownParents.includes(name);
  }

  /**
   * Clear cache (useful for testing or force refresh)
   */
  clearCache(): void {
    this.cache = null;
  }
}
