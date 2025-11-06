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
    console.log(chalk.bold('\n📍 Current Configuration\n'));
    console.log(`  Target CLI: ${chalk.cyan(config.targetCLI)}`);
    
    if (config.cliPath) {
      console.log(`  CLI Path:   ${config.cliPath}`);
    }
    
    if (config.defaultArgs.length > 0) {
      console.log(`  Default Args: ${config.defaultArgs.join(' ')}`);
    }

    // Try to get version
    const currentVersion = await UniversalCLIExecutor.getVersion(config.targetCLI);
    if (currentVersion) {
      console.log(`  Version:    ${currentVersion}`);
    }

    console.log();

    // Select new CLI
    const newCLI = await selectNewCLI();
    if (!newCLI) return config; // User cancelled

    // Validate availability
    console.log(chalk.gray(`\nChecking availability of ${newCLI}...`));
    const isAvailable = UniversalCLIExecutor.isAvailable(newCLI);

    if (!isAvailable) {
      console.log(Formatters.error(`\n✗ ${newCLI} not found in PATH`));
      console.log(chalk.gray('Make sure it is installed and accessible.\n'));
      
      const customPath = await Prompts.confirm('Specify custom path?', false);
      if (!customPath) {
        return config;
      }

      const cliPath = await Prompts.textInput('Enter full path to CLI binary:', {
        required: true,
      });

      // Update config with custom path
      config.targetCLI = newCLI;
      config.cliPath = cliPath;
      config.defaultArgs = [];

      console.log(Formatters.success(`\n✓ Switched to ${newCLI} (custom path)\n`));
      return config;
    }

    // Get version of new CLI
    const newVersion = await UniversalCLIExecutor.getVersion(newCLI);
    console.log(chalk.green(`✓ Found: ${newCLI}${newVersion ? ` (v${newVersion})` : ''}`));

    // Configure default args
    const configureArgs = await Prompts.confirm('\nConfigure default arguments?', false);
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
    config.cliPath = undefined; // Clear custom path
    config.defaultArgs = defaultArgs;

    console.log(Formatters.success(`\n✓ Switched to ${newCLI}\n`));

    return config;

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
    // Discover CLIs from system
    let discovered = await discoverCLIs({
      maxConcurrent: 15,
      timeout: 1500,
      minScore: -5,  // Allow negative scores for comprehensive list
      limit: 200,    // Get top 200 candidates
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
    spinner.stop();
    console.log(chalk.red('Discovery failed. You can enter a custom command.\n'));

    const customCLI = await Prompts.textInput('Enter CLI command name:', {
      required: true,
    });
    return customCLI.trim();
  }
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
