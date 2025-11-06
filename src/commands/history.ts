/**
 * Command History Browser
 * Browse, replay, and manage command execution history
 */

import { Prompts } from '../ui/prompts.js';
import { Formatters } from '../ui/formatters.js';
import { Spinner } from '../ui/spinners.js';
import { UniversalCLIExecutor } from '../core/executor.js';
import type { AppConfig } from '../types/config.js';
import type { CommandExecution } from '../types/cli.js';
import chalk from 'chalk';
import Table from 'cli-table3';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { formatNavigationHint } from '../ui/keyboard-handler.js';

/**
 * Get history file path
 */
function getHistoryFilePath(): string {
  const configDir = path.join(os.homedir(), '.climb');
  return path.join(configDir, 'history.json');
}

/**
 * Load command history from disk
 */
export async function loadHistory(): Promise<CommandExecution[]> {
  try {
    const historyPath = getHistoryFilePath();
    const data = await fs.readFile(historyPath, 'utf-8');
    const history = JSON.parse(data);
    
    // Convert timestamp strings back to Date objects
    return history.map((exec: any) => ({
      ...exec,
      timestamp: new Date(exec.timestamp),
    }));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      // File doesn't exist yet
      return [];
    }
    throw error;
  }
}

/**
 * Save command history to disk
 */
export async function saveHistory(history: CommandExecution[]): Promise<void> {
  const historyPath = getHistoryFilePath();
  const configDir = path.dirname(historyPath);

  // Ensure directory exists
  await fs.mkdir(configDir, { recursive: true });

  // Write history
  await fs.writeFile(historyPath, JSON.stringify(history, null, 2), 'utf-8');
}

/**
 * Add execution to history
 */
export async function addToHistory(
  execution: CommandExecution,
  maxSize: number = 100
): Promise<void> {
  let history = await loadHistory();

  // Add new execution at the beginning
  history.unshift(execution);

  // Trim to max size (FIFO)
  if (history.length > maxSize) {
    history = history.slice(0, maxSize);
  }

  await saveHistory(history);
}

/**
 * Interactive history browser
 */
export async function historyBrowserInteractive(config: AppConfig): Promise<void> {
  console.log(Formatters.header('Command History'));
  console.log();
  process.stdout.write(formatNavigationHint('navigation'));

  try {
    const history = await loadHistory();

    if (history.length === 0) {
      console.log(Formatters.warning('No command history yet.'));
      console.log(chalk.gray('Commands will appear here after you execute them.\n'));
      return;
    }

    while (true) {
      // Display history table
      console.log(chalk.bold(`\n📜 Recent Commands (${history.length} total)\n`));

      const widths = computeHistoryColWidths();
      const table = new Table({
        head: ['#', 'Command', 'Exit', 'Duration', 'When'],
        colWidths: widths,
        style: {
          head: ['cyan'],
        },
      });

      history.slice(0, 20).forEach((exec, index) => {
        const commandStr = `${exec.command} ${exec.args.join(' ')}`;
        const truncated = commandStr.length > 48 
          ? commandStr.slice(0, 45) + '...'
          : commandStr;
        
        const exitStatus = exec.exitCode === 0 
          ? chalk.green('✓ 0') 
          : chalk.red(`✗ ${exec.exitCode}`);
        
        const timeAgo = formatTimeAgo(exec.timestamp);

        table.push([
          (index + 1).toString(),
          truncated,
          exitStatus,
          `${exec.duration}ms`,
          timeAgo,
        ]);
      });

      console.log(table.toString());
      console.log();

      // Action menu
      const action = await Prompts.select('What would you like to do?', [
        { value: 'view', name: '👁️  View Details', description: 'See full output of a command' },
        { value: 'rerun', name: '🔄 Re-run', description: 'Execute command again' },
        { value: 'edit', name: '✏️  Edit & Run', description: 'Modify args before running' },
        { value: 'clear', name: '🗑️  Clear History', description: 'Delete all entries' },
        { value: 'export', name: '💾 Export', description: 'Save history to file' },
        { value: 'back', name: '← Back', description: 'Return to main menu' },
      ]);

      if (action === 'back') break;

      switch (action) {
        case 'view':
          await viewExecutionDetails(history);
          break;
        
        case 'rerun':
          await rerunCommand(history, config);
          break;
        
        case 'edit':
          await editAndRunCommand(history, config);
          break;
        
        case 'clear':
          const confirmed = await Prompts.confirm('Delete all history?', false);
          if (confirmed) {
            await saveHistory([]);
            console.log(Formatters.success('\n✓ History cleared\n'));
            return;
          }
          break;
        
        case 'export':
          await exportHistory(history);
          break;
      }
    }

  } catch (error) {
    if (error instanceof Error && error.name === 'ExitPromptError') {
      return;
    }
    throw error;
  }
}

/**
 * View full details of a command execution
 */
async function viewExecutionDetails(history: CommandExecution[]): Promise<void> {
  const indexStr = await Prompts.textInput('Enter command number:', { required: true });
  const index = parseInt(indexStr, 10) - 1;

  if (isNaN(index) || index < 0 || index >= history.length) {
    console.log(Formatters.error('Invalid command number'));
    return;
  }

  const exec = history[index];
  if (!exec) {
    console.log(Formatters.error('Command not found in history'));
    return;
  }

  console.log(Formatters.header('Command Details'));
  console.log();
  console.log(chalk.bold('Command:'), chalk.cyan(`${exec.command} ${exec.args.join(' ')}`));
  console.log(chalk.bold('Exit Code:'), exec.exitCode === 0 ? chalk.green('0 (success)') : chalk.red(`${exec.exitCode} (failed)`));
  console.log(chalk.bold('Duration:'), `${exec.duration}ms`);
  console.log(chalk.bold('Timestamp:'), exec.timestamp.toLocaleString());
  
  console.log(chalk.bold('\nOutput:\n'));
  if (exec.output.trim()) {
    console.log(exec.output);
  } else {
    console.log(chalk.gray('(no output)'));
  }

  if (exec.error) {
    console.log(chalk.bold('\nError:\n'));
    console.log(chalk.red(exec.error));
  }

  console.log();
  await Prompts.confirm('Press Enter to continue', true);
}

/**
 * Re-run a command from history
 */
async function rerunCommand(history: CommandExecution[], config: AppConfig): Promise<void> {
  const indexStr = await Prompts.textInput('Enter command number:', { required: true });
  const index = parseInt(indexStr, 10) - 1;

  if (isNaN(index) || index < 0 || index >= history.length) {
    console.log(Formatters.error('Invalid command number'));
    return;
  }

  const exec = history[index];
  if (!exec) {
    console.log(Formatters.error('Command not found in history'));
    return;
  }

  const commandString = `${exec.command} ${exec.args.join(' ')}`;

  console.log(chalk.cyan(`\nRe-running: ${commandString}\n`));

  const spinner = new Spinner();
  spinner.start('Executing...');

  const executor = new UniversalCLIExecutor(exec.command, config.defaultArgs);

  try {
    const result = await executor.execute(exec.args, {
      timeout: config.timeout.execute,
    });

    spinner.succeed(`Completed in ${result.duration}ms`);

    console.log(chalk.bold('\n✨ Output:\n'));
    if (result.stdout.trim()) {
      console.log(result.stdout);
    } else {
      console.log(chalk.gray('(no output)'));
    }

    // Save to history
    if (config.execution.captureHistory) {
      await addToHistory({
        command: exec.command,
        args: exec.args,
        timestamp: new Date(),
        exitCode: result.exitCode,
        duration: result.duration,
        output: result.stdout,
        error: result.stderr || undefined,
      }, config.execution.maxHistorySize);
    }

  } catch (error) {
    spinner.fail('Execution failed');
    console.log(chalk.red('\n✗ Error:\n'));
    console.log((error as Error).message);

    // Save failed execution
    if (config.execution.captureHistory) {
      await addToHistory({
        command: exec.command,
        args: exec.args,
        timestamp: new Date(),
        exitCode: 1,
        duration: 0,
        output: '',
        error: (error as Error).message,
      }, config.execution.maxHistorySize);
    }
  }

  console.log();
  await Prompts.confirm('Press Enter to continue', true);
}

/**
 * Edit and run a command from history
 */
async function editAndRunCommand(history: CommandExecution[], config: AppConfig): Promise<void> {
  const indexStr = await Prompts.textInput('Enter command number:', { required: true });
  const index = parseInt(indexStr, 10) - 1;

  if (isNaN(index) || index < 0 || index >= history.length) {
    console.log(Formatters.error('Invalid command number'));
    return;
  }

  const exec = history[index];
  if (!exec) {
    console.log(Formatters.error('Command not found in history'));
    return;
  }

  const currentArgs = exec.args.join(' ');

  console.log(chalk.gray(`\nCurrent: ${exec.command} ${currentArgs}\n`));

  const newArgsString = await Prompts.textInput('Enter new arguments:', {
    default: currentArgs,
    required: false,
  });

  const newArgs = newArgsString.trim().split(/\s+/).filter(Boolean);

  // Execute with new args
  const commandString = `${exec.command} ${newArgs.join(' ')}`;
  console.log(chalk.cyan(`\nExecuting: ${commandString}\n`));

  const spinner = new Spinner();
  spinner.start('Running...');

  const executor = new UniversalCLIExecutor(exec.command, config.defaultArgs);

  try {
    const result = await executor.execute(newArgs, {
      timeout: config.timeout.execute,
    });

    spinner.succeed(`Completed in ${result.duration}ms`);

    console.log(chalk.bold('\n✨ Output:\n'));
    if (result.stdout.trim()) {
      console.log(result.stdout);
    } else {
      console.log(chalk.gray('(no output)'));
    }

    // Save to history
    if (config.execution.captureHistory) {
      await addToHistory({
        command: exec.command,
        args: newArgs,
        timestamp: new Date(),
        exitCode: result.exitCode,
        duration: result.duration,
        output: result.stdout,
        error: result.stderr || undefined,
      }, config.execution.maxHistorySize);
    }

  } catch (error) {
    spinner.fail('Execution failed');
    console.log(chalk.red('\n✗ Error:\n'));
    console.log((error as Error).message);
  }

  console.log();
  await Prompts.confirm('Press Enter to continue', true);
}

/**
 * Export history to file
 */
async function exportHistory(history: CommandExecution[]): Promise<void> {
  const filename = `climb-history-${new Date().toISOString().split('T')[0]}.json`;
  const filepath = path.join(process.cwd(), filename);

  await fs.writeFile(filepath, JSON.stringify(history, null, 2), 'utf-8');

  console.log(Formatters.success(`\n✓ History exported to: ${filepath}\n`));
  await Prompts.confirm('Press Enter to continue', true);
}

/**
 * Format time ago (e.g., "2 minutes ago")
 */
function formatTimeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);

  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  return date.toLocaleDateString();
}

/**
 * Compute responsive column widths for history table
 */
function computeHistoryColWidths(): number[] {
  const cols = process.stdout.columns || 100;
  const padding = 6;
  const usable = Math.max(60, cols - padding);
  const base = [5, 8, 9, 12, 20]; // initial idea for [#, Exit, Duration, When, Command]
  // We'll map to [#, Command, Exit, Duration, When]
  const fixed = base[0]! + base[1]! + base[2]! + base[3]!; // non-command approx
  const commandWidth = Math.max(30, usable - fixed);
  return [base[0]!, commandWidth, base[1]!, base[2]!, base[3]!];
}
