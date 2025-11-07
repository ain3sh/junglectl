/**
 * Explore Commands - Universal CLI Navigation
 * Main workflow for discovering, navigating, and executing any CLI
 */

import { Prompts } from '../ui/prompts.js';
import { Formatters } from '../ui/formatters.js';
import { Spinner } from '../ui/spinners.js';
import { UniversalCLIExecutor } from '../core/executor.js';
import { CLIIntrospector } from '../core/introspection.js';
import { HelpParser } from '../core/help-parser.js';
import type { AppConfig } from '../types/config.js';
import type { CommandEntity } from '../types/cli.js';
import type { CommandStructure } from '../core/introspection.js';
import chalk from 'chalk';
import { formatNavigationHint } from '../ui/keyboard-handler.js';

/**
 * Main explore workflow - discover and execute CLI commands
 */
export async function exploreCommandsInteractive(config: AppConfig): Promise<void> {
  console.log(Formatters.header(`Explore ${config.targetCLI} Commands`));
  console.log();
  process.stdout.write(formatNavigationHint('navigation'));

  try {
    // Step 1: Introspect CLI to get command structure
    console.log(chalk.gray('Discovering commands...\n'));
    const spinner = new Spinner();
    spinner.start('Analyzing CLI structure...');

    // Use appropriate introspection based on CLI type
    let structure;
    if (config.targetCLI === 'mcpjungle') {
      const introspector = new CLIIntrospector(config.registryUrl);
      structure = await introspector.getCommandStructure();
    } else {
      // For generic CLIs, use HelpParser with UniversalCLIExecutor
      structure = await discoverGenericCLI(config.targetCLI, spinner);
    }

    spinner.succeed(`Found ${structure.commands.length} commands`);

    if (structure.commands.length === 0) {
      console.log(Formatters.warning('No commands discovered. The CLI might not have --help support.'));
      return;
    }

    // Step 2: Select a command
    const commands = structure.commands.map(c => ({
      ...c,
      hasSubcommands: c.hasSubcommands || false,
      confidence: c.confidence || 0.5,
    }));
    const command = await selectCommand(commands, config);
    if (!command) return; // User cancelled

    // Step 3: Check for subcommands
    const subcommandPath = await navigateSubcommands([command.name], config, structure);
    if (!subcommandPath) return; // User cancelled

    // Step 4: Build arguments for the command
    const args = await buildCommandArgs(subcommandPath);
    if (!args) return; // User cancelled

    // Step 5: Execute the command
    await executeCommand(subcommandPath, args, config);

  } catch (error) {
    if (error instanceof Error && error.name === 'ExitPromptError') {
      console.log(chalk.gray('\n✗ Cancelled\n'));
      return;
    }
    throw error;
  }
}

/**
 * Select a command from the discovered list
 */
async function selectCommand(commands: CommandEntity[], config: AppConfig): Promise<CommandEntity | null> {
  console.log(chalk.bold('\n📋 Available Commands\n'));

  // Sort by confidence and name
  const sortedCommands = commands.sort((a, b) => {
    if (b.confidence !== a.confidence) {
      return b.confidence - a.confidence;
    }
    return a.name.localeCompare(b.name);
  });

  const choices = sortedCommands.map(cmd => ({
    value: cmd.name,
    name: `${cmd.name}${cmd.hasSubcommands ? ' >' : ''}${config.execution.showConfidence ? ` · ${Math.round(cmd.confidence * 100)}%` : ''}`,
    description: `${cmd.description}`,
  }));

  // Add back option
  choices.push({ value: '__back', name: '← Back', description: 'Return to main menu' });

  try {
    const selected = await Prompts.select(
      `Select a ${config.targetCLI} command:`,
      choices
    );

    if (selected === '__back') return null;

    const command = sortedCommands.find(c => c.name === selected);
    return command || null;
  } catch (error) {
    if (error instanceof Error && error.name === 'ExitPromptError') {
      // User pressed ESC
      return null;
    }
    throw error;
  }
}

/**
 * Navigate through subcommand tree if present
 */
async function navigateSubcommands(
  path: string[],
  config: AppConfig,
  structure: CommandStructure
): Promise<string[] | null> {
  const currentCommand = path[path.length - 1];
  if (!currentCommand) return path;

  const subcommands = structure.subcommands.get(currentCommand);

  if (!subcommands || subcommands.length === 0) {
    // No subcommands, return current path
    return path;
  }

  // Show subcommands
  console.log(chalk.bold(`\n📂 ${path.join(' > ')} › Subcommands\n`));

  const choices = subcommands.map(sub => ({
    value: sub.name,
    name: sub.name,
    description: sub.description,
  }));

  // Add option to execute current command without subcommand
  choices.push({ value: '__execute', name: '▶ Execute this command', description: 'Run without subcommand' });
  choices.push({ value: '__back', name: '← Back', description: 'Go back' });

  try {
    const selected = await Prompts.select('Select subcommand or execute:', choices);

    if (selected === '__back') return null;
    if (selected === '__execute') return path;

    // Recurse into subcommand
    return navigateSubcommands([...path, selected], config, structure);
  } catch (error) {
    if (error instanceof Error && error.name === 'ExitPromptError') {
      // User pressed ESC
      return null;
    }
    throw error;
  }
}

/**
 * Build command arguments interactively
 */
async function buildCommandArgs(commandPath: string[]): Promise<string[] | null> {
  console.log(chalk.bold(`\n⚙️  Configure: ${commandPath.join(' ')}\n`));

  // Ask for additional arguments
  const hasArgs = await Prompts.confirm('Add arguments or flags?', false);
  
  if (!hasArgs) {
    return [];
  }

  // Manual argument input (future: parse options and build form)
  const argsString = await Prompts.textInput(
    'Enter arguments (space-separated):',
    { required: false }
  );

  if (!argsString || argsString.trim() === '') {
    return [];
  }

  // Simple split by spaces (future: proper shell parsing)
  return argsString.trim().split(/\s+/);
}

/**
 * Execute the command and display results
 */
async function executeCommand(
  commandPath: string[],
  args: string[],
  config: AppConfig
): Promise<void> {
  const fullCommand = [...commandPath, ...args];
  const commandString = `${config.targetCLI} ${fullCommand.join(' ')}`;

  // Show preview
  console.log(chalk.bold('\n📝 Command Preview\n'));
  console.log(chalk.cyan(`  ${commandString}\n`));

  const confirmed = await Prompts.confirm('Execute this command?', true);
  if (!confirmed) {
    console.log(chalk.yellow('\n✗ Execution cancelled\n'));
    return;
  }

  // Execute
  console.log(chalk.bold('\n🚀 Executing...\n'));
  const spinner = new Spinner();
  spinner.start('Running command...');

  const executor = new UniversalCLIExecutor(
    config.targetCLI,
    config.defaultArgs
  );

  const startTime = Date.now();
  let result;

  try {
    result = await executor.execute(fullCommand, {
      timeout: config.timeout.execute,
    });

    spinner.succeed(`Completed in ${result.duration}ms`);

    // Display output
    console.log(chalk.bold('\n✨ Output:\n'));
    if (result.stdout.trim()) {
      console.log(result.stdout);
    } else {
      console.log(chalk.gray('(no output)'));
    }

    if (result.stderr.trim()) {
      console.log(chalk.yellow('\nStderr:'));
      console.log(result.stderr);
    }

    // Save to history if enabled
    if (config.execution.captureHistory) {
      await saveToHistory({
        command: config.targetCLI,
        args: fullCommand,
        timestamp: new Date(),
        exitCode: result.exitCode,
        duration: result.duration,
        output: result.stdout,
        error: result.stderr || undefined,
      });
      console.log(chalk.gray('\n✓ Saved to history'));
    }

    // Post-execution menu
    console.log();
    const nextAction = await Prompts.select('What next?', [
      { value: 'again', name: '🔄 Run again', description: 'Execute same command' },
      { value: 'modify', name: '✏️  Modify and run', description: 'Change arguments' },
      { value: 'back', name: '← Back', description: 'Return to command selection' },
    ]);

    if (nextAction === 'again') {
      await executeCommand(commandPath, args, config);
    } else if (nextAction === 'modify') {
      const newArgs = await buildCommandArgs(commandPath);
      if (newArgs) {
        await executeCommand(commandPath, newArgs, config);
      }
    }

  } catch (error) {
    spinner.fail('Execution failed');
    console.log(chalk.red('\n✗ Error:\n'));
    console.log((error as Error).message);

    // Save failed execution to history
    if (config.execution.captureHistory) {
      await saveToHistory({
        command: config.targetCLI,
        args: fullCommand,
        timestamp: new Date(),
        exitCode: 1,
        duration: Date.now() - startTime,
        output: '',
        error: (error as Error).message,
      });
    }
  }
}

/**
 * Save command execution to history
 */
async function saveToHistory(execution: any): Promise<void> {
  const { addToHistory } = await import('./history.js');
  await addToHistory(execution, 100); // Use default max size
}

/**
 * Discover generic CLI commands using HelpParser
 * This is for non-mcpjungle CLIs like git, docker, npm, etc.
 */
async function discoverGenericCLI(cliName: string, spinner: Spinner): Promise<CommandStructure> {
  const executor = new UniversalCLIExecutor(cliName);
  const parser = new HelpParser();

  // Try different help flags
  const helpProbes = [['--help'], ['-h'], ['help']];
  let helpText = '';

  for (const args of helpProbes) {
    try {
      spinner.update(`Trying ${cliName} ${args.join(' ')}...`);
      const result = await executor.execute(args, {
        timeout: 8000,
        acceptOutputOnError: true,
      });
      if (result.stdout.trim()) {
        helpText = result.stdout;
        break;
      }
    } catch {
      // Try next probe
      continue;
    }
  }

  if (!helpText) {
    // No help found - return empty structure
    return {
      commands: [],
      subcommands: new Map(),
      telemetry: { subcommands: {}, probes: [] },
      timestamp: Date.now(),
    };
  }

  // Parse help text
  const parsed = parser.parse(helpText);

  // Convert to command structure format
  const commands = parsed.commands
    .filter(cmd => cmd.confidence >= 0.35)
    .map(cmd => ({
      name: cmd.name,
      description: cmd.description,
      category: 'basic' as const,
      hasSubcommands: false, // Will be updated if subcommands found
      confidence: cmd.confidence,
    }));

  // Probe for subcommands on high-confidence commands
  const subcommands = new Map<string, any[]>();
  const highConfidenceCommands = commands.filter(c => c.confidence >= 0.5).slice(0, 10);

  for (const command of highConfidenceCommands) {
    try {
      spinner.update(`Checking ${cliName} ${command.name} for subcommands...`);
      const result = await executor.execute([command.name, '--help'], {
        timeout: 5000,
        acceptOutputOnError: true,
      });

      if (result.stdout.trim()) {
        const subParsed = parser.parse(result.stdout);
        const subs = subParsed.commands
          .filter(sub => sub.name !== command.name && sub.confidence >= 0.35)
          .map(sub => ({
            name: sub.name,
            description: sub.description,
            confidence: sub.confidence,
            path: [command.name, sub.name],
          }));

        if (subs.length > 0) {
          subcommands.set(command.name, subs);
          // Update parent command to indicate it has subcommands
          command.hasSubcommands = true;
        }
      }
    } catch {
      // Subcommand check failed, skip
      continue;
    }
  }

  return {
    commands,
    subcommands,
    telemetry: {
      root: parsed.telemetry,
      subcommands: {},
      probes: [],
    },
    timestamp: Date.now(),
  };
}
