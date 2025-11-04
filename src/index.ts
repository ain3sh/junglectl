#!/usr/bin/env node

/**
 * JungleCTL - Interactive MCPJungle CLI
 * Main entry point
 */

import { Prompts } from './ui/prompts.js';
import { Formatters } from './ui/formatters.js';
import { MCPJungleExecutor } from './core/executor.js';
import { OutputParser } from './core/parser.js';
import { registerServerInteractive } from './commands/register.js';
import { browseInteractive, listServers, listTools } from './commands/list.js';
import { invokeToolInteractive } from './commands/invoke.js';
import { groupsMenuInteractive } from './commands/groups.js';
import { enableDisableMenuInteractive } from './commands/enable-disable.js';
import { settingsMenuInteractive } from './commands/settings.js';
import { loadConfig, saveConfig, isFirstRun, getConfigFilePath } from './core/config.js';
import { CLIIntrospector } from './core/introspection.js';
import { DynamicMenuBuilder } from './core/menu-builder.js';
import type { AppConfig } from './types/config.js';
import chalk from 'chalk';

/**
 * Show first-run welcome message
 */
async function showWelcomeIfFirstRun(): Promise<void> {
  if (await isFirstRun()) {
    console.log(chalk.cyan.bold('\n  👋 Welcome to JungleCTL!\n'));
    console.log(chalk.gray('  This is your first run. Your preferences will be saved to:'));
    console.log(chalk.gray(`  ${getConfigFilePath()}\n`));
    console.log(chalk.gray('  You can change settings anytime from the main menu.\n'));
  }
}

/**
 * Main menu
 */
async function mainMenu(): Promise<void> {
  // Load configuration
  let config: AppConfig;
  try {
    config = await loadConfig();
    
    // Save config on first run
    if (await isFirstRun()) {
      await saveConfig(config);
      await showWelcomeIfFirstRun();
      await new Promise(resolve => setTimeout(resolve, 2000)); // Brief pause to read message
    }
  } catch (error) {
    console.error(Formatters.error('Failed to load configuration'));
    console.error((error as Error).message);
    console.log(chalk.gray('\nUsing default configuration...\n'));
    const { DEFAULT_CONFIG } = await import('./types/config.js');
    config = DEFAULT_CONFIG;
  }

  // Check if mcpjungle is available
  const isAvailable = await MCPJungleExecutor.isAvailable();
  if (!isAvailable) {
    console.error(Formatters.error('MCPJungle CLI not found in PATH'));
    console.log(chalk.gray('\nPlease install MCPJungle first:'));
    console.log(chalk.gray('  brew install mcpjungle/mcpjungle/mcpjungle'));
    console.log(chalk.gray('  or download from: https://github.com/mcpjungle/MCPJungle/releases\n'));
    process.exit(1);
  }

  // Get server status
  const executor = new MCPJungleExecutor(config.registryUrl);
  let serverStatus;
  
  try {
    const result = await executor.execute(['version'], { timeout: 3000 });
    serverStatus = OutputParser.parseServerStatus(result.stdout, config.registryUrl);
  } catch {
    serverStatus = {
      connected: false,
      url: config.registryUrl,
    };
  }

  // Display header
  console.clear();
  console.log(chalk.cyan.bold('\n  🌴 JungleCTL v1.0.0\n'));
  console.log('  ' + Formatters.statusBar(serverStatus));
  console.log();

  if (!serverStatus.connected) {
    console.log(Formatters.warning('Cannot connect to MCPJungle server'));
    console.log(chalk.gray('\nMake sure the server is running:'));
    console.log(chalk.gray('  docker compose up -d'));
    console.log(chalk.gray('  or: mcpjungle start\n'));

    const shouldContinue = await Prompts.confirm('Continue anyway?', false);
    if (!shouldContinue) {
      process.exit(0);
    }
  }

  // Create introspector and menu builder (dynamic!)
  const introspector = new CLIIntrospector(config.registryUrl);
  const menuBuilder = new DynamicMenuBuilder(introspector);

  // Main loop
  while (true) {
    try {
      // Build menu dynamically from MCPJungle structure
      let menuChoices;
      try {
        menuChoices = await menuBuilder.buildMainMenu();
      } catch {
        // Fallback to hardcoded menu if introspection fails
        menuChoices = [
          { value: 'list', name: '📋 Browse Resources', description: 'View servers, tools, groups, prompts' },
          { value: 'invoke', name: '🔧 Invoke Tool', description: 'Execute tool with interactive input' },
          { value: 'register', name: '➕ Register MCP Server', description: 'Add a new MCP server to the registry' },
          { value: 'create', name: '✨ Create', description: 'Create groups and other entities' },
          { value: 'enable', name: '✅ Enable', description: 'Enable tools and servers' },
          { value: 'disable', name: '❌ Disable', description: 'Disable tools and servers' },
          { value: 'settings', name: '⚙️  Settings', description: 'Configure JungleCTL' },
          { value: 'exit', name: '❌ Exit', description: 'Quit JungleCTL' },
        ];
      }

      const action = await Prompts.select('What would you like to do?', menuChoices);

      console.log(); // Spacing

      // Route based on action (dynamic + special cases)
      switch (action) {
        case 'list':
          // Special handling for browse (has submenu)
          await browseInteractive(config.registryUrl);
          break;

        case 'invoke':
          // Special handling for invoke (complex workflow)
          await invokeToolInteractive(config.registryUrl);
          break;

        case 'register':
          // Special handling for register (complex wizard)
          await registerServerInteractive(config.registryUrl);
          break;

        case 'create':
          // Handle create submenu (groups, etc.)
          await groupsMenuInteractive(config.registryUrl);
          break;

        case 'enable':
        case 'disable':
          // Handle enable/disable menu
          await enableDisableMenuInteractive(config.registryUrl);
          break;

        case 'settings':
          // App-specific settings
          config = await settingsMenuInteractive(config);
          break;

        case 'exit':
          console.log(chalk.cyan('\n👋 Goodbye!\n'));
          process.exit(0);

        // Legacy cases (still support old menu structure)
        case 'browse':
          await browseInteractive(config.registryUrl);
          break;

        case 'groups':
          await groupsMenuInteractive(config.registryUrl);
          break;

        case 'enable-disable':
          await enableDisableMenuInteractive(config.registryUrl);
          break;

        case 'servers':
          await listServers(config.registryUrl);
          await Prompts.confirm('Press Enter to continue', true);
          break;

        case 'tools':
          await listTools({ registryUrl: config.registryUrl });
          await Prompts.confirm('Press Enter to continue', true);
          break;

        default:
          // Unknown command
          console.log(Formatters.warning(`Command "${action}" not yet implemented`));
          await Prompts.confirm('Press Enter to continue', true);
      }

      // Clear screen before next iteration
      console.clear();
      console.log(chalk.cyan.bold('\n  🌴 JungleCTL v1.0.0\n'));
      console.log('  ' + Formatters.statusBar(serverStatus));
      console.log();

    } catch (error) {
      if (error instanceof Error) {
        console.error('\n' + Formatters.error(error.message));
        await Prompts.confirm('\nPress Enter to continue', true);
      } else {
        throw error;
      }
    }
  }
}



/**
 * Error handler
 */
process.on('uncaughtException', (error) => {
  console.error('\n' + Formatters.error('Unexpected error:'));
  console.error(error.message);
  console.error(chalk.gray('\nStack trace:'));
  console.error(chalk.gray(error.stack || 'No stack trace available'));
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  console.error('\n' + Formatters.error('Unhandled promise rejection:'));
  console.error(reason);
  process.exit(1);
});

// Handle Ctrl+C gracefully
process.on('SIGINT', () => {
  console.log(chalk.cyan('\n\n👋 Goodbye!\n'));
  process.exit(0);
});

// Start the application
mainMenu().catch((error) => {
  console.error('\n' + Formatters.error('Fatal error:'));
  console.error(error.message);
  process.exit(1);
});
