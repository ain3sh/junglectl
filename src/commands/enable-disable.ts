/**
 * Enable/Disable Commands
 * Manage tool and server status
 */

import { Prompts } from '../ui/prompts.js';
import { Formatters } from '../ui/formatters.js';
import { Spinner } from '../ui/spinners.js';
import { MCPJungleExecutor } from '../core/executor.js';
import { cache } from '../core/cache.js';
import { formatError, UserCancelledError } from '../utils/errors.js';
import chalk from 'chalk';

const executor = new MCPJungleExecutor();

/**
 * Enable/Disable management submenu
 */
export async function enableDisableMenuInteractive(registryUrl?: string): Promise<void> {
  while (true) {
    try {
      console.log(chalk.gray('Press ESC to go back\n'));
      
      const action = await Prompts.select('Enable/Disable Management', [
        { value: 'disable-tool', name: '🔇 Disable Tool', description: 'Disable a specific tool' },
        { value: 'enable-tool', name: '🔊 Enable Tool', description: 'Enable a specific tool' },
        { value: 'disable-server', name: '🔇 Disable Server', description: 'Disable all tools from a server' },
        { value: 'enable-server', name: '🔊 Enable Server', description: 'Enable a server' },
        { value: 'back', name: '← Back', description: 'Return to main menu' },
      ]);

      if (action === 'back') break;

      try {
        switch (action) {
          case 'disable-tool':
            await disableToolInteractive(registryUrl);
            break;
          case 'enable-tool':
            await enableToolInteractive(registryUrl);
            break;
          case 'disable-server':
            await disableServerInteractive(registryUrl);
            break;
          case 'enable-server':
            await enableServerInteractive(registryUrl);
            break;
        }

        await Prompts.confirm('Continue?', true);
      } catch (error) {
        if (error instanceof Error && error.name === 'ExitPromptError') {
          // User pressed ESC in submenu - go back
          break;
        }
        if (error instanceof UserCancelledError) {
          console.log(chalk.yellow('\n✗ Operation cancelled'));
        } else {
          console.error('\n' + formatError(error));
        }
        await Prompts.confirm('Continue?', true);
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'ExitPromptError') {
        // User pressed ESC on enable/disable menu - go back to main
        break;
      }
      throw error; // Unexpected error
    }
  }
}

/**
 * Disable a tool
 */
export async function disableToolInteractive(registryUrl?: string): Promise<void> {
  console.log(Formatters.header('Disable Tool'));

  const tool = await Prompts.selectTool('Select tool to disable', undefined, registryUrl);

  console.log(chalk.yellow(`\n⚠ This will disable "${tool}" globally`));
  console.log(chalk.gray('The tool will not be available for invocation.\n'));

  const confirmed = await Prompts.confirm('Proceed?', true);
  if (!confirmed) {
    console.log(chalk.yellow('\n✗ Operation cancelled'));
    return;
  }

  // Create executor with registry URL if provided (legacy MCP support)
  const exec = registryUrl ? new MCPJungleExecutor(registryUrl) : executor;
  
  const spinner = new Spinner();
  spinner.start('Disabling tool...');

  try {
    await exec.execute(['disable', 'tool', tool]);

    // Invalidate tools cache
    cache.invalidate('tools');

    spinner.succeed(`Tool "${tool}" disabled`);
  } catch (error) {
    spinner.fail('Operation failed');
    throw error;
  }
}

/**
 * Enable a tool
 */
export async function enableToolInteractive(registryUrl?: string): Promise<void> {
  console.log(Formatters.header('Enable Tool'));

  const tool = await Prompts.selectTool('Select tool to enable', undefined, registryUrl);

  // Create executor with registry URL if provided (legacy MCP support)
  const exec = registryUrl ? new MCPJungleExecutor(registryUrl) : executor;
  
  const spinner = new Spinner();
  spinner.start('Enabling tool...');

  try {
    await exec.execute(['enable', 'tool', tool]);

    // Invalidate tools cache
    cache.invalidate('tools');

    spinner.succeed(`Tool "${tool}" enabled`);
  } catch (error) {
    spinner.fail('Operation failed');
    throw error;
  }
}

/**
 * Disable a server (disables all its tools)
 */
export async function disableServerInteractive(registryUrl?: string): Promise<void> {
  console.log(Formatters.header('Disable Server'));

  const server = await Prompts.selectServer('Select server to disable', registryUrl);

  console.log(chalk.yellow(`\n⚠ This will disable ALL tools from "${server}"`));
  console.log(chalk.gray('All tools from this server will become unavailable.\n'));

  const confirmed = await Prompts.confirm('Proceed?', false);
  if (!confirmed) {
    console.log(chalk.yellow('\n✗ Operation cancelled'));
    return;
  }

  // Create executor with registry URL if provided (legacy MCP support)
  const exec = registryUrl ? new MCPJungleExecutor(registryUrl) : executor;
  
  const spinner = new Spinner();
  spinner.start('Disabling server...');

  try {
    await exec.execute(['disable', 'server', server]);

    // Invalidate all caches (servers and tools affected)
    cache.invalidate();

    spinner.succeed(`Server "${server}" disabled`);
    console.log(chalk.gray('\nAll tools from this server are now disabled.\n'));
  } catch (error) {
    spinner.fail('Operation failed');
    throw error;
  }
}

/**
 * Enable a server
 */
export async function enableServerInteractive(registryUrl?: string): Promise<void> {
  console.log(Formatters.header('Enable Server'));

  const server = await Prompts.selectServer('Select server to enable', registryUrl);

  // Create executor with registry URL if provided (legacy MCP support)
  const exec = registryUrl ? new MCPJungleExecutor(registryUrl) : executor;
  
  const spinner = new Spinner();
  spinner.start('Enabling server...');

  try {
    await exec.execute(['enable', 'server', server]);

    // Invalidate all caches
    cache.invalidate();

    spinner.succeed(`Server "${server}" enabled`);
    console.log(chalk.gray('\nAll tools from this server are now enabled.\n'));
  } catch (error) {
    spinner.fail('Operation failed');
    throw error;
  }
}
