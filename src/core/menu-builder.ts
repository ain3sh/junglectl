/**
 * Dynamic Menu Builder
 * Generates interactive menus from discovered CLI structure
 */

import { CLIIntrospector, Command, Subcommand } from './introspection.js';

export interface MenuChoice {
  value: string;
  name: string;
  description?: string;
}

/**
 * Builds menus dynamically from CLI introspection
 */
export class DynamicMenuBuilder {
  private introspector: CLIIntrospector;

  constructor(introspector: CLIIntrospector) {
    this.introspector = introspector;
  }

  /**
   * Build main menu from discovered commands
   */
  async buildMainMenu(): Promise<MenuChoice[]> {
    const structure = await this.introspector.getCommandStructure();
    const choices: MenuChoice[] = [];

    // Priority order for commands (manual for UX consistency)
    const priorityOrder = [
      'list',      // Browse Resources
      'invoke',    // Invoke Tool
      'register',  // Register Server
      'create',    // Create entities
      'get',       // Get entities
      'enable',    // Enable
      'disable',   // Disable
      'update',    // Update
      'delete',    // Delete
      'deregister',// Deregister
    ];

    // Add commands in priority order
    for (const cmdName of priorityOrder) {
      const cmd = structure.commands.find(c => c.name === cmdName);
      if (cmd && this.isInteractive(cmd)) {
        choices.push(this.formatMenuItem(cmd));
      }
    }

    // Add any other interactive commands not in priority list
    for (const cmd of structure.commands) {
      if (this.isInteractive(cmd) && !priorityOrder.includes(cmd.name)) {
        choices.push(this.formatMenuItem(cmd));
      }
    }

    // Always add Settings (app-specific, not MCPJungle command)
    choices.push({
      value: 'settings',
      name: '⚙️  Settings',
      description: 'Configure JungleCTL preferences',
    });

    // Always add Exit
    choices.push({
      value: 'exit',
      name: '❌ Exit',
      description: 'Quit JungleCTL',
    });

    return choices;
  }

  /**
   * Build submenu for commands with subcommands
   */
  async buildSubmenu(command: string): Promise<MenuChoice[]> {
    const structure = await this.introspector.getCommandStructure();
    const subcommands = structure.subcommands.get(command);

    if (!subcommands || subcommands.length === 0) {
      return [];
    }

    const choices = subcommands.map(sub => this.formatSubmenuItem(command, sub));

    // Add "Back" option
    choices.push({
      value: 'back',
      name: '← Back',
      description: 'Return to main menu',
    });

    return choices;
  }

  /**
   * Determine if command should be in interactive menu
   */
  private isInteractive(cmd: Command): boolean {
    // Exclude commands that don't make sense interactively
    const excluded = [
      'start',      // Server management, not interactive
      'version',    // Just shows version
      'init-server',// Enterprise setup
      'login',      // Enterprise auth
      'usage',      // Internal use (we call it programmatically)
    ];

    return !excluded.includes(cmd.name);
  }

  /**
   * Format main menu item with emoji and styling
   */
  private formatMenuItem(cmd: Command): MenuChoice {
    const emoji = this.getCommandEmoji(cmd.name);
    const formattedName = this.formatCommandName(cmd.name);

    return {
      value: cmd.name,
      name: `${emoji} ${formattedName}`,
      description: cmd.description,
    };
  }

  /**
   * Format submenu item
   */
  private formatSubmenuItem(parent: string, sub: Subcommand): MenuChoice {
    const emoji = this.getSubcommandEmoji(parent, sub.name);
    const formattedName = this.formatCommandName(sub.name);

    return {
      value: sub.name,
      name: `${emoji} ${formattedName}`,
      description: sub.description,
    };
  }

  /**
   * Get emoji for command
   */
  private getCommandEmoji(command: string): string {
    const emojiMap: Record<string, string> = {
      'list': '📋',
      'invoke': '🔧',
      'register': '➕',
      'get': '🔍',
      'create': '✨',
      'delete': '🗑️',
      'enable': '✅',
      'disable': '❌',
      'update': '🔄',
      'deregister': '➖',
    };

    return emojiMap[command] || '📄';
  }

  /**
   * Get emoji for subcommand based on parent and name
   */
  private getSubcommandEmoji(_parent: string, subcommand: string): string {
    // Resource type emojis
    const resourceEmojiMap: Record<string, string> = {
      'servers': '🔌',
      'tools': '🔧',
      'groups': '📦',
      'group': '📦',
      'prompts': '💬',
      'prompt': '💬',
      'users': '👤',
      'user': '👤',
      'mcp-clients': '🤖',
      'mcp-client': '🤖',
      'workflows': '🔄',
      'workflow': '🔄',
      'templates': '📝',
      'template': '📝',
      'tool': '🔧',
      'server': '🔌',
    };

    return resourceEmojiMap[subcommand] || '📄';
  }

  /**
   * Format command name for display
   */
  private formatCommandName(name: string): string {
    // Handle hyphenated names
    if (name.includes('-')) {
      return name
        .split('-')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
    }

    // Simple capitalization
    return name.charAt(0).toUpperCase() + name.slice(1);
  }

  /**
   * Get user-friendly name for command (for display)
   */
  getUserFriendlyName(command: string): string {
    const nameMap: Record<string, string> = {
      'list': 'Browse Resources',
      'invoke': 'Invoke Tool',
      'register': 'Register MCP Server',
      'create': 'Create',
      'get': 'View Details',
      'delete': 'Delete',
      'enable': 'Enable',
      'disable': 'Disable',
      'update': 'Update',
      'deregister': 'Deregister Server',
    };

    return nameMap[command] || this.formatCommandName(command);
  }
}
