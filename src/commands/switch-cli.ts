/**
 * CLI Switcher
 * Switch between different CLI tools (git, docker, npm, etc.)
 */

import { Prompts } from '../ui/prompts.js';
import { Formatters } from '../ui/formatters.js';
import { UniversalCLIExecutor } from '../core/executor.js';
import type { AppConfig } from '../types/config.js';
import chalk from 'chalk';

/**
 * Popular CLIs list
 */
const POPULAR_CLIS = [
  { name: 'git', description: 'Version control system' },
  { name: 'docker', description: 'Container management' },
  { name: 'npm', description: 'Node package manager' },
  { name: 'kubectl', description: 'Kubernetes CLI' },
  { name: 'python3', description: 'Python interpreter' },
  { name: 'ffmpeg', description: 'Media processing' },
  { name: 'curl', description: 'HTTP client' },
  { name: 'aws', description: 'AWS CLI' },
  { name: 'gcloud', description: 'Google Cloud CLI' },
  { name: 'terraform', description: 'Infrastructure as code' },
  { name: 'ansible', description: 'IT automation' },
  { name: 'mcpjungle', description: 'MCP tool manager (legacy)' },
];

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
 * Select a new CLI from popular list or custom
 */
async function selectNewCLI(): Promise<string | null> {
  console.log(chalk.bold('🔍 Select CLI\n'));

  // Detect which popular CLIs are available
  const available = POPULAR_CLIS.map(cli => ({
    ...cli,
    isAvailable: UniversalCLIExecutor.isAvailable(cli.name),
  }));

  const choices = available.map(cli => ({
    value: cli.name,
    name: `${cli.name}${cli.isAvailable ? ' ✓' : ''}`,
    description: cli.description,
  }));

  // Add custom option
  choices.push({
    value: '__custom',
    name: '📝 Custom CLI',
    description: 'Enter a custom CLI command',
  });

  choices.push({
    value: '__back',
    name: '← Back',
    description: 'Cancel',
  });

  const selected = await Prompts.select('Which CLI would you like to explore?', choices);

  if (selected === '__back') return null;
  
  if (selected === '__custom') {
    const customCLI = await Prompts.textInput('Enter CLI command name:', {
      required: true,
    });
    return customCLI.trim();
  }

  return selected;
}
