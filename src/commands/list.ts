/**
 * List Commands
 * Browse servers, tools, groups, and prompts
 */

import { Prompts } from '../ui/prompts.js';
import { Formatters } from '../ui/formatters.js';
import { withSpinner } from '../ui/spinners.js';
import { MCPJungleExecutor } from '../core/executor.js';
import { OutputParser } from '../core/parser.js';
import { ResourceHandler } from '../core/resource-handler.js';
import { CLIIntrospector } from '../core/introspection.js';
import { DynamicMenuBuilder } from '../core/menu-builder.js';
import chalk from 'chalk';
import { formatNavigationHint } from '../ui/keyboard-handler.js';

const executor = new MCPJungleExecutor();

export async function listServers(registryUrl?: string): Promise<void> {
  // Create executor with registry URL if provided (legacy MCP support)
  const exec = registryUrl ? new MCPJungleExecutor(registryUrl) : executor;
  
  const servers = await withSpinner(
    'Fetching servers...',
    async () => {
      const result = await exec.execute(['list', 'servers']);
      return OutputParser.parseServers(result.stdout);
    },
    { successMessage: 'Servers loaded' }
  );

  console.log('\n' + Formatters.serversTable(servers) + '\n');

  if (servers.length > 0) {
    console.log(chalk.gray(`Total: ${servers.length} server(s)\n`));
  }
}

export async function listTools(options: {
  serverFilter?: string;
  registryUrl?: string;
} = {}): Promise<void> {
  // Create executor with registry URL if provided (legacy MCP support)
  const exec = options.registryUrl ? new MCPJungleExecutor(options.registryUrl) : executor;
  
  const args = ['list', 'tools'];
  if (options.serverFilter) {
    args.push('--server', options.serverFilter);
  }

  const tools = await withSpinner(
    options.serverFilter
      ? `Fetching tools for ${options.serverFilter}...`
      : 'Fetching all tools...',
    async () => {
      const result = await exec.execute(args);
      return OutputParser.parseTools(result.stdout);
    },
    { successMessage: 'Tools loaded' }
  );

  console.log('\n' + Formatters.toolsTable(tools) + '\n');

  if (tools.length > 0) {
    console.log(chalk.gray(`Total: ${tools.length} tool(s)\n`));
  }
}

export async function listGroups(registryUrl?: string): Promise<void> {
  // Create executor with registry URL if provided (legacy MCP support)
  const exec = registryUrl ? new MCPJungleExecutor(registryUrl) : executor;
  
  const groups = await withSpinner(
    'Fetching tool groups...',
    async () => {
      const result = await exec.execute(['list', 'groups']);
      return OutputParser.parseGroups(result.stdout);
    },
    { successMessage: 'Groups loaded' }
  );

  console.log('\n' + Formatters.groupsTable(groups) + '\n');

  if (groups.length > 0) {
    console.log(chalk.gray(`Total: ${groups.length} group(s)\n`));
  }
}

export async function listPrompts(options: {
  serverFilter?: string;
  registryUrl?: string;
} = {}): Promise<void> {
  // Create executor with registry URL if provided (legacy MCP support)
  const exec = options.registryUrl ? new MCPJungleExecutor(options.registryUrl) : executor;
  
  const args = ['list', 'prompts'];
  if (options.serverFilter) {
    args.push('--server', options.serverFilter);
  }

  const prompts = await withSpinner(
    'Fetching prompts...',
    async () => {
      const result = await exec.execute(args);
      return OutputParser.parsePrompts(result.stdout);
    },
    { successMessage: 'Prompts loaded' }
  );

  console.log('\n' + Formatters.promptsTable(prompts) + '\n');

  if (prompts.length > 0) {
    console.log(chalk.gray(`Total: ${prompts.length} prompt(s)\n`));
  }
}

/**
 * Interactive browse menu - DYNAMIC VERSION
 * Automatically discovers available list commands from MCPJungle
 */
export async function browseInteractive(registryUrl?: string): Promise<void> {
  const introspector = new CLIIntrospector(registryUrl);
  const menuBuilder = new DynamicMenuBuilder(introspector);
  const resourceHandler = new ResourceHandler(registryUrl);

  while (true) {
    try {
      console.log(chalk.gray('Press ESC to go back\n'));
      process.stdout.write(formatNavigationHint('navigation'));
      
      // Build menu dynamically from discovered 'list' subcommands
      let choices;
      try {
        choices = await menuBuilder.buildSubmenu('list');
      } catch {
        // Fallback to hardcoded if introspection fails
        choices = [
          { value: 'servers', name: '🔌 Servers', description: 'View registered servers' },
          { value: 'tools', name: '🔧 Tools', description: 'Browse available tools' },
          { value: 'groups', name: '📦 Tool Groups', description: 'Browse tool groups' },
          { value: 'prompts', name: '💬 Prompts', description: 'View available prompts' },
          { value: 'back', name: '← Back', description: 'Return to main menu' },
        ];
      }

      const choice = await Prompts.select('What would you like to browse?', choices);

      if (choice === 'back') break;

      try {
        // Handle tools separately for filtering option
        if (choice === 'tools') {
          await browseTools(registryUrl);
        } else {
          // Generic handler for any other resource type
          await resourceHandler.listResource(choice, { registryUrl });
        }

        // Pause before returning to menu
        await Prompts.confirm('Continue?', true);
      } catch (error) {
        if (error instanceof Error && error.name === 'ExitPromptError') {
          // User pressed ESC in submenu - go back
          break;
        }
        if (error instanceof Error) {
          console.error(Formatters.error(error.message));
        }
        await Prompts.confirm('Continue?', true);
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'ExitPromptError') {
        // User pressed ESC on browse menu - go back to main
        break;
      }
      throw error; // Unexpected error
    }
  }
}

/**
 * Interactive tool browsing with filtering
 */
async function browseTools(registryUrl?: string): Promise<void> {
  const filterChoice = await Prompts.select('How would you like to view tools?', [
    { value: 'all', name: 'All Tools', description: 'Show all available tools' },
    { value: 'by-server', name: 'Filter by Server', description: 'Show tools from specific server' },
  ]);

  if (filterChoice === 'all') {
    await listTools({ registryUrl });
  } else {
    try {
      const server = await Prompts.selectServer('Select server to filter by', registryUrl);
      await listTools({ serverFilter: server, registryUrl });
    } catch (error: any) {
      if (error instanceof Error && error.message.includes('No servers')) {
        console.log(Formatters.warning('No servers registered yet'));
      } else {
        throw error;
      }
    }
  }
}
