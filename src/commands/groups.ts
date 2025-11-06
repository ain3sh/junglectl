/**
 * Tool Groups Management Commands
 * Create, view, and delete tool groups
 */

import { Prompts } from '../ui/prompts.js';
import { Formatters } from '../ui/formatters.js';
import { Spinner, withSpinner } from '../ui/spinners.js';
import { MCPJungleExecutor } from '../core/executor.js';
import { OutputParser } from '../core/parser.js';
import { cache } from '../core/cache.js';
import type { ToolGroupConfig } from '../types/mcpjungle.js';
import { formatError, UserCancelledError } from '../utils/errors.js';
import chalk from 'chalk';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { formatNavigationHint } from '../ui/keyboard-handler.js';

const executor = new MCPJungleExecutor();

/**
 * Groups management submenu
 */
export async function groupsMenuInteractive(registryUrl?: string): Promise<void> {
  while (true) {
    try {
      console.log(chalk.gray('Press ESC to go back\n'));
      process.stdout.write(formatNavigationHint('navigation'));
      
      const action = await Prompts.select('Tool Groups Management', [
        { value: 'create', name: '➕ Create Group', description: 'Create a new tool group' },
        { value: 'view', name: '👁️  View Group Details', description: 'View group composition' },
        { value: 'list', name: '📋 List All Groups', description: 'Show all tool groups' },
        { value: 'delete', name: '🗑️  Delete Group', description: 'Remove a tool group' },
        { value: 'back', name: '← Back', description: 'Return to main menu' },
      ]);

      if (action === 'back') break;

      try {
        switch (action) {
          case 'create':
            await createGroupInteractive(registryUrl);
            break;
          case 'view':
            await viewGroupInteractive(registryUrl);
            break;
          case 'list':
            await listGroupsInteractive(registryUrl);
            break;
          case 'delete':
            await deleteGroupInteractive(registryUrl);
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
        // User pressed ESC on groups menu - go back to main
        break;
      }
      throw error; // Unexpected error
    }
  }
}

/**
 * Create a new tool group
 */
export async function createGroupInteractive(registryUrl?: string): Promise<void> {
  console.log(Formatters.header('Create Tool Group'));

  // Basic information
  console.log(chalk.bold('\n📝 Basic Information\n'));

  const name = await Prompts.textInput('Group name', {
    required: true,
    validate: (value) => {
      if (!/^[a-zA-Z0-9_-]+$/.test(value)) {
        return 'Name must be alphanumeric (underscores and hyphens allowed, no spaces)';
      }
      if (value.includes('__')) {
        return 'Name cannot contain double underscores (__)';
      }
      return true;
    },
  });

  const description = await Prompts.textInput('Description (optional)', {
    required: false,
  });

  // Strategy selection
  console.log(chalk.bold('\n🎯 Group Strategy\n'));
  console.log(chalk.gray('Choose how to build this group:\n'));

  const strategy = await Prompts.select('Group strategy', [
    {
      value: 'tools',
      name: '🔧 Specific Tools',
      description: 'Cherry-pick individual tools',
    },
    {
      value: 'servers',
      name: '🔌 Entire Servers',
      description: 'Include all tools from selected servers',
    },
    {
      value: 'mixed',
      name: '🎭 Mixed Approach',
      description: 'Combine tools + servers + exclusions',
    },
  ]);

  // Build configuration
  const config: ToolGroupConfig = { name };
  if (description) config.description = description;

  // Collect included tools
  if (strategy === 'tools' || strategy === 'mixed') {
    console.log(chalk.bold('\n🔧 Select Tools\n'));
    const tools = await Prompts.selectMultipleTools('Select tools to include (space to select, enter when done)', registryUrl);
    if (tools.length > 0) {
      config.included_tools = tools;
    }
  }

  // Collect included servers
  if (strategy === 'servers' || strategy === 'mixed') {
    console.log(chalk.bold('\n🔌 Select Servers\n'));
    const servers = await Prompts.selectMultipleServers('Select servers to include (space to select, enter when done)', registryUrl);
    if (servers.length > 0) {
      config.included_servers = servers;
    }
  }

  // Collect exclusions (mixed mode only)
  if (strategy === 'mixed') {
    const wantExclusions = await Prompts.confirm('\nAdd tool exclusions?', false);
    if (wantExclusions) {
      console.log(chalk.bold('\n🚫 Exclude Tools\n'));
      const excluded = await Prompts.selectMultipleTools('Select tools to EXCLUDE (space to select, enter when done)', registryUrl);
      if (excluded.length > 0) {
        config.excluded_tools = excluded;
      }
    }
  }

  // Validate configuration
  if (!config.included_tools?.length && !config.included_servers?.length) {
    throw new Error('Group must include at least one tool or server');
  }

  // Review and confirm
  console.log(chalk.bold('\n📋 Review Configuration\n'));
  console.log(Formatters.prettyJson(config));

  const confirmed = await Prompts.confirm('\nCreate this group?', true);
  if (!confirmed) {
    console.log(chalk.yellow('\n✗ Group creation cancelled'));
    return;
  }

  // Execute creation
  // Create executor with registry URL if provided (legacy MCP support)
  const exec = registryUrl ? new MCPJungleExecutor(registryUrl) : executor;
  
  const spinner = new Spinner();
  spinner.start('Creating group...');

  try {
    // Write config to temp file
    const tempFile = path.join(os.tmpdir(), `group-${Date.now()}.json`);
    await fs.writeFile(tempFile, JSON.stringify(config, null, 2));

    // Execute registration
    await exec.execute(['create', 'group', '-c', tempFile], {
      timeout: 15000,
    });

    // Clean up temp file
    await fs.unlink(tempFile).catch(() => {});

    // Invalidate cache
    cache.invalidate('groups');

    spinner.succeed(`Group "${name}" created successfully!`);
    console.log(chalk.gray('\nYou can now use this group to organize tools.\n'));

  } catch (error) {
    spinner.fail('Group creation failed');
    throw error;
  }
}

/**
 * View group details
 */
export async function viewGroupInteractive(registryUrl?: string): Promise<void> {
  console.log(Formatters.header('View Group Details'));

  const group = await Prompts.selectGroup('Select group to view', registryUrl);

  // Create executor with registry URL if provided (legacy MCP support)
  const exec = registryUrl ? new MCPJungleExecutor(registryUrl) : executor;

  const result = await withSpinner(
    `Fetching details for "${group}"...`,
    async () => {
      return await exec.execute(['get', 'group', group]);
    },
    { successMessage: 'Details loaded' }
  );

  console.log('\n' + Formatters.header(group));
  console.log(result.stdout);
  console.log();
}

/**
 * List all groups
 */
export async function listGroupsInteractive(registryUrl?: string): Promise<void> {
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

/**
 * Delete a group
 */
export async function deleteGroupInteractive(registryUrl?: string): Promise<void> {
  console.log(Formatters.header('Delete Tool Group'));

  const group = await Prompts.selectGroup('Select group to delete', registryUrl);

  console.log(chalk.yellow(`\n⚠ You are about to delete group "${group}"`));
  console.log(chalk.gray('This action cannot be undone.\n'));

  const confirmed = await Prompts.confirm('Are you sure?', false);
  if (!confirmed) {
    console.log(chalk.yellow('\n✗ Deletion cancelled'));
    return;
  }

  // Create executor with registry URL if provided (legacy MCP support)
  const exec = registryUrl ? new MCPJungleExecutor(registryUrl) : executor;
  
  const spinner = new Spinner();
  spinner.start('Deleting group...');

  try {
    await exec.execute(['delete', 'group', group]);

    // Invalidate cache
    cache.invalidate('groups');

    spinner.succeed(`Group "${group}" deleted`);
  } catch (error) {
    spinner.fail('Deletion failed');
    throw error;
  }
}
