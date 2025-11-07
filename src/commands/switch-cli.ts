/**
 * CLI Switcher
 * Switch between different CLI tools using dynamic discovery
 */

import { Prompts } from '../ui/prompts.js';
import { Formatters } from '../ui/formatters.js';
import { Spinner } from '../ui/spinners.js';
import { UniversalCLIExecutor } from '../core/executor.js';
import { discoverCLIs, type DiscoveredCLI } from '../core/cli-discovery.js';
import type { AppConfig } from '../types/config.js';
import search from '@inquirer/search';
import chalk from 'chalk';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

/**
 * Well-known CLI tools (for score boosting only, not exclusive list)
 * These get extra points if discovered, improving their ranking
 */
const WELL_KNOWN_TOOLS = new Set([
  'git', 'docker', 'npm', 'kubectl', 'python3', 'python', 'node',
  'ffmpeg', 'curl', 'wget', 'aws', 'gcloud', 'az', 'terraform',
  'ansible', 'cargo', 'rustc', 'go', 'java', 'mvn', 'gradle',
  'make', 'cmake', 'gcc', 'clang', 'jq', 'yq', 'gh', 'heroku',
  'mcpjungle',
]);

/**
 * Interactive CLI switcher
 */
export async function switchCLIInteractive(config: AppConfig): Promise<AppConfig> {
  console.log(Formatters.header('Switch CLI'));

  try {
    // Show current CLI
    console.log(chalk.bold('\n📍 Current CLI: ') + chalk.cyan(config.targetCLI));
    const currentVersion = await UniversalCLIExecutor.getVersion(config.targetCLI);
    if (currentVersion) {
      console.log(chalk.gray(`  Version: ${currentVersion}`));
    }
    console.log();

    // Load cached CLIs
    const cached = await loadCachedCLIs();

    // Build initial menu
    const initialChoices = [];

    if (cached && cached.length > 0) {
      initialChoices.push({
        value: '__cached',
        name: `📦 Select from ${cached.length} previously discovered CLIs`,
        description: 'Choose from cached CLI tools',
      });
    }

    initialChoices.push(
      {
        value: '__manual',
        name: '🔍 Enter CLI name manually',
        description: 'Targeted search for a specific command',
      },
      {
        value: '__discover',
        name: '🌐 Discover all commands on PATH',
        description: 'Scan system for all available CLIs (may take 1-2 minutes)',
      },
      {
        value: '__back',
        name: '← Back',
        description: 'Return to main menu',
      }
    );

    const mode = await Prompts.select('How would you like to find a CLI?', initialChoices);

    switch (mode) {
      case '__cached':
        return await selectFromCached(cached, config);
      case '__manual':
        return await selectManually(config);
      case '__discover':
        return await discoverAndSelect(config);
      case '__back':
        return config;
      default:
        return config;
    }
  } catch (error) {
    if (error instanceof Error && error.name === 'ExitPromptError') {
      return config;
    }
    throw error;
  }
}

/**
 * Select a new CLI from discovered tools
 */
async function selectNewCLI(): Promise<string | null> {
  console.log(chalk.bold('🔍 Discovering CLI tools from your system...\n'));

  const spinner = new Spinner();
  spinner.start('Scanning PATH directories...');

  try {
    // Discover CLIs from system with safe performance settings
    let discovered = await discoverCLIs({
      maxConcurrent: 8,   // CRITICAL: Keep low to prevent spawning too many processes (reduced from 30)
      timeout: 1500,      // Slightly longer timeout for slower CLIs (increased from 1000ms)
      minScore: -5,       // Allow negative scores for comprehensive list
      limit: 200,         // Get top 200 candidates
      onProgress: (current, total) => {
        // Update spinner with progress
        spinner.update(`Testing CLI tools (${current}/${total})...`);
      },
    });

    spinner.stop();

    if (discovered.length === 0) {
      console.log(chalk.yellow('No CLI tools discovered. You can enter a custom command.\n'));
      const customCLI = await Prompts.textInput('Enter CLI command name:', {
        required: true,
      });
      return customCLI.trim();
    }

    // Boost well-known tools
    discovered = discovered.map(cli => {
      if (WELL_KNOWN_TOOLS.has(cli.name)) {
        return { ...cli, score: cli.score + 5 };
      }
      return cli;
    });

    // Re-sort after boosting
    discovered.sort((a, b) => b.score - a.score);

    console.log(chalk.gray(`Found ${discovered.length} CLI tools\n`));
    console.log(chalk.gray('Type to search, or browse with arrow keys\n'));

    try {
      // Use searchable select for better UX with many options
      const selected = await search({
        message: 'Which CLI would you like to explore?',
        source: async (input) => {
          const filtered = input
            ? discovered.filter(cli =>
                cli.name.toLowerCase().includes(input.toLowerCase())
              )
            : discovered;

          const choices = filtered.slice(0, 50).map(cli => {
            const helpIndicator = cli.hasHelp ? '📖' : '  ';
            const categoryBadge = getCategoryBadge(cli.category);

            return {
              value: cli.name,
              name: `${helpIndicator} ${cli.name}`,
              description: `${categoryBadge} ${cli.path}`,
            };
          });

          // Add special options at the end
          if (!input || 'custom'.includes(input.toLowerCase())) {
            choices.push({
              value: '__custom',
              name: '📝 Custom CLI',
              description: 'Enter a CLI command name manually',
            });
          }

          if (!input || 'back'.includes(input.toLowerCase())) {
            choices.push({
              value: '__back',
              name: '← Back',
              description: 'Cancel and return',
            });
          }

          return choices;
        },
      });

      if (selected === '__back') return null;

      if (selected === '__custom') {
        const customCLI = await Prompts.textInput('Enter CLI command name:', {
          required: true,
        });
        return customCLI.trim();
      }

      return selected;
    } catch (error) {
      if (error instanceof Error && error.name === 'ExitPromptError') {
        // User pressed ESC
        return null;
      }
      throw error;
    }

  } catch (error) {
    spinner.stop();
    console.log(chalk.red('Discovery failed. You can enter a custom command.\n'));

    const customCLI = await Prompts.textInput('Enter CLI command name:', {
      required: true,
    });
    return customCLI.trim();
  }
}

/**
 * Load cached CLI discovery results
 */
async function loadCachedCLIs(): Promise<DiscoveredCLI[]> {
  try {
    const CACHE_FILE = path.join(os.homedir(), '.climb', 'cli-discovery-cache.json');
    const data = await fs.readFile(CACHE_FILE, 'utf-8');
    const cached = JSON.parse(data);
    return cached.clis || [];
  } catch {
    return [];
  }
}

/**
 * Select from cached CLIs
 */
async function selectFromCached(cached: DiscoveredCLI[], config: AppConfig): Promise<AppConfig> {
  console.log(chalk.gray('\nUsing cached CLI list\n'));

  // Boost well-known tools
  const boosted = cached.map(cli => {
    if (WELL_KNOWN_TOOLS.has(cli.name)) {
      return { ...cli, score: cli.score + 5 };
    }
    return cli;
  });

  boosted.sort((a, b) => b.score - a.score);

  const newCLI = await selectFromDiscovered(boosted);
  if (!newCLI) return config; // User cancelled

  return await finalizeCLISelection(newCLI, config);
}

/**
 * Manual CLI entry with targeted search
 */
async function selectManually(config: AppConfig): Promise<AppConfig> {
  console.log(chalk.gray('\nEnter the CLI command name (e.g., python3, docker, npm)\n'));

  const cliName = await Prompts.textInput('CLI command name:', { required: true });
  const trimmed = cliName.trim();

  console.log(chalk.gray(`\nChecking if "${trimmed}" is available...\n`));

  const isAvailable = UniversalCLIExecutor.isAvailable(trimmed);

  if (!isAvailable) {
    console.log(Formatters.error(`\n✗ "${trimmed}" not found in PATH`));
    console.log(chalk.gray('Make sure it is installed and accessible.\n'));

    const customPath = await Prompts.confirm('Specify custom path?', false);
    if (!customPath) {
      return config;
    }

    const cliPath = await Prompts.textInput('Enter full path to CLI binary:', {
      required: true,
    });

    config.targetCLI = trimmed;
    config.cliPath = cliPath;
    config.defaultArgs = [];

    console.log(Formatters.success(`\n✓ Switched to ${trimmed} (custom path)\n`));
    return config;
  }

  // CLI is available
  console.log(chalk.green(`✓ Found: ${trimmed}\n`));

  return await finalizeCLISelection(trimmed, config);
}

/**
 * Full discovery with confirmation
 */
async function discoverAndSelect(config: AppConfig): Promise<AppConfig> {
  console.log(chalk.yellow('\n⚠️  Full PATH discovery scans all executables on your system.\n'));
  console.log(chalk.gray('This may take 1-2 minutes, but results are cached for future use.\n'));

  const confirmed = await Prompts.confirm('Proceed with discovery?', false);
  if (!confirmed) {
    return config;
  }

  const newCLI = await selectNewCLI();
  if (!newCLI) return config;

  return await finalizeCLISelection(newCLI, config);
}

/**
 * Shared logic for selecting from discovered CLIs
 */
async function selectFromDiscovered(discovered: DiscoveredCLI[]): Promise<string | null> {
  try {
    const selected = await search({
      message: 'Which CLI would you like to explore?',
      source: async (input) => {
        const filtered = input
          ? discovered.filter(cli =>
              cli.name.toLowerCase().includes(input.toLowerCase())
            )
          : discovered;

        const choices = filtered.slice(0, 50).map(cli => {
          const helpIndicator = cli.hasHelp ? '📖' : '  ';
          const categoryBadge = getCategoryBadge(cli.category);

          return {
            value: cli.name,
            name: `${helpIndicator} ${cli.name}`,
            description: `${categoryBadge} ${cli.path}`,
          };
        });

        if (!input || 'back'.includes(input.toLowerCase())) {
          choices.push({
            value: '__back',
            name: '← Back',
            description: 'Cancel and return',
          });
        }

        return choices;
      },
    });

    if (selected === '__back') return null;
    return selected;
  } catch (error) {
    if (error instanceof Error && error.name === 'ExitPromptError') {
      return null;
    }
    throw error;
  }
}

/**
 * Finalize CLI selection with version check and default args
 */
async function finalizeCLISelection(newCLI: string, config: AppConfig): Promise<AppConfig> {
  // Get version
  const newVersion = await UniversalCLIExecutor.getVersion(newCLI);
  if (newVersion) {
    console.log(chalk.gray(`Version: ${newVersion}\n`));
  }

  // Configure default args
  const configureArgs = await Prompts.confirm('Configure default arguments?', false);
  let defaultArgs: string[] = [];

  if (configureArgs) {
    const argsString = await Prompts.textInput('Enter default args (e.g., --no-pager):', {
      required: false,
    });

    if (argsString.trim()) {
      defaultArgs = argsString.trim().split(/\s+/);
    }
  }

  // Update config
  config.targetCLI = newCLI;
  config.cliPath = undefined;
  config.defaultArgs = defaultArgs;

  console.log(Formatters.success(`\n✓ Switched to ${newCLI}\n`));

  return config;
}

/**
 * Get category badge for display
 */
function getCategoryBadge(category: DiscoveredCLI['category']): string {
  switch (category) {
    case 'user-installed':
      return chalk.green('user');
    case 'language-tool':
      return chalk.blue('lang');
    case 'system':
      return chalk.gray('sys');
    case 'unknown':
      return chalk.dim('~');
  }
}
