import { Prompts } from '../ui/prompts.js';
import { Formatters } from '../ui/formatters.js';
import { Spinner } from '../ui/spinners.js';
import { UniversalCLIExecutor } from '../core/executor.js';
import { CLIIntrospector } from '../core/introspection.js';
import chalk from 'chalk';
export async function exploreCommandsInteractive(config) {
    console.log(Formatters.header(`Explore ${config.targetCLI} Commands`));
    try {
        console.log(chalk.gray('Discovering commands...\n'));
        const spinner = new Spinner();
        spinner.start('Analyzing CLI structure...');
        const introspector = new CLIIntrospector();
        const structure = await introspector.getCommandStructure();
        spinner.succeed(`Found ${structure.commands.length} commands`);
        if (structure.commands.length === 0) {
            console.log(Formatters.warning('No commands discovered. The CLI might not have --help support.'));
            return;
        }
        const commands = structure.commands.map(c => ({
            ...c,
            hasSubcommands: c.hasSubcommands || false,
            confidence: c.confidence || 0.5,
        }));
        const command = await selectCommand(commands, config);
        if (!command)
            return;
        const subcommandPath = await navigateSubcommands([command.name], config);
        if (!subcommandPath)
            return;
        const args = await buildCommandArgs(subcommandPath);
        if (!args)
            return;
        await executeCommand(subcommandPath, args, config);
    }
    catch (error) {
        if (error instanceof Error && error.name === 'ExitPromptError') {
            console.log(chalk.gray('\n✗ Cancelled\n'));
            return;
        }
        throw error;
    }
}
async function selectCommand(commands, config) {
    console.log(chalk.bold('\n📋 Available Commands\n'));
    const sortedCommands = commands.sort((a, b) => {
        if (b.confidence !== a.confidence) {
            return b.confidence - a.confidence;
        }
        return a.name.localeCompare(b.name);
    });
    const choices = sortedCommands.map(cmd => ({
        value: cmd.name,
        name: `${cmd.name}${cmd.hasSubcommands ? ' >' : ''}`,
        description: `${cmd.description}${config.execution.showConfidence ? ` [${Math.round(cmd.confidence * 100)}%]` : ''}`,
    }));
    choices.push({ value: '__back', name: '← Back', description: 'Return to main menu' });
    const selected = await Prompts.select(`Select a ${config.targetCLI} command:`, choices);
    if (selected === '__back')
        return null;
    const command = sortedCommands.find(c => c.name === selected);
    return command || null;
}
async function navigateSubcommands(path, config) {
    const introspector = new CLIIntrospector();
    const structure = await introspector.getCommandStructure();
    const currentCommand = path[path.length - 1];
    if (!currentCommand)
        return path;
    const subcommands = structure.subcommands.get(currentCommand);
    if (!subcommands || subcommands.length === 0) {
        return path;
    }
    console.log(chalk.bold(`\n📂 ${path.join(' > ')} › Subcommands\n`));
    const choices = subcommands.map(sub => ({
        value: sub.name,
        name: sub.name,
        description: sub.description,
    }));
    choices.push({ value: '__execute', name: '▶ Execute this command', description: 'Run without subcommand' });
    choices.push({ value: '__back', name: '← Back', description: 'Go back' });
    const selected = await Prompts.select('Select subcommand or execute:', choices);
    if (selected === '__back')
        return null;
    if (selected === '__execute')
        return path;
    return navigateSubcommands([...path, selected], config);
}
async function buildCommandArgs(commandPath) {
    console.log(chalk.bold(`\n⚙️  Configure: ${commandPath.join(' ')}\n`));
    const hasArgs = await Prompts.confirm('Add arguments or flags?', false);
    if (!hasArgs) {
        return [];
    }
    const argsString = await Prompts.textInput('Enter arguments (space-separated):', { required: false });
    if (!argsString || argsString.trim() === '') {
        return [];
    }
    return argsString.trim().split(/\s+/);
}
async function executeCommand(commandPath, args, config) {
    const fullCommand = [...commandPath, ...args];
    const commandString = `${config.targetCLI} ${fullCommand.join(' ')}`;
    console.log(chalk.bold('\n📝 Command Preview\n'));
    console.log(chalk.cyan(`  ${commandString}\n`));
    const confirmed = await Prompts.confirm('Execute this command?', true);
    if (!confirmed) {
        console.log(chalk.yellow('\n✗ Execution cancelled\n'));
        return;
    }
    console.log(chalk.bold('\n🚀 Executing...\n'));
    const spinner = new Spinner();
    spinner.start('Running command...');
    const executor = new UniversalCLIExecutor(config.targetCLI, config.defaultArgs);
    const startTime = Date.now();
    let result;
    try {
        result = await executor.execute(fullCommand, {
            timeout: config.timeout.execute,
        });
        spinner.succeed(`Completed in ${result.duration}ms`);
        console.log(chalk.bold('\n✨ Output:\n'));
        if (result.stdout.trim()) {
            console.log(result.stdout);
        }
        else {
            console.log(chalk.gray('(no output)'));
        }
        if (result.stderr.trim()) {
            console.log(chalk.yellow('\nStderr:'));
            console.log(result.stderr);
        }
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
        console.log();
        const nextAction = await Prompts.select('What next?', [
            { value: 'again', name: '🔄 Run again', description: 'Execute same command' },
            { value: 'modify', name: '✏️  Modify and run', description: 'Change arguments' },
            { value: 'back', name: '← Back', description: 'Return to command selection' },
        ]);
        if (nextAction === 'again') {
            await executeCommand(commandPath, args, config);
        }
        else if (nextAction === 'modify') {
            const newArgs = await buildCommandArgs(commandPath);
            if (newArgs) {
                await executeCommand(commandPath, newArgs, config);
            }
        }
    }
    catch (error) {
        spinner.fail('Execution failed');
        console.log(chalk.red('\n✗ Error:\n'));
        console.log(error.message);
        if (config.execution.captureHistory) {
            await saveToHistory({
                command: config.targetCLI,
                args: fullCommand,
                timestamp: new Date(),
                exitCode: 1,
                duration: Date.now() - startTime,
                output: '',
                error: error.message,
            });
        }
    }
}
async function saveToHistory(execution) {
    const { addToHistory } = await import('./history.js');
    await addToHistory(execution, 100);
}
//# sourceMappingURL=explore.js.map