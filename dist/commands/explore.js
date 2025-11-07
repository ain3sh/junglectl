import { Prompts } from '../ui/prompts.js';
import { Formatters } from '../ui/formatters.js';
import { Spinner } from '../ui/spinners.js';
import { UniversalCLIExecutor } from '../core/executor.js';
import { CLIIntrospector } from '../core/introspection.js';
import { HelpParser } from '../core/help-parser.js';
import chalk from 'chalk';
import { formatNavigationHint } from '../ui/keyboard-handler.js';
export async function exploreCommandsInteractive(config) {
    console.log(Formatters.header(`Explore ${config.targetCLI} Commands`));
    console.log();
    process.stdout.write(formatNavigationHint('navigation'));
    try {
        console.log(chalk.gray('Discovering commands...\n'));
        const spinner = new Spinner();
        spinner.start('Analyzing CLI structure...');
        let structure;
        if (config.targetCLI === 'mcpjungle') {
            const introspector = new CLIIntrospector(config.registryUrl);
            structure = await introspector.getCommandStructure();
        }
        else {
            structure = await discoverGenericCLI(config.targetCLI, spinner);
        }
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
        const subcommandPath = await navigateSubcommands([command.name], config, structure);
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
        name: `${cmd.name}${cmd.hasSubcommands ? ' >' : ''}${config.execution.showConfidence ? ` · ${Math.round(cmd.confidence * 100)}%` : ''}`,
        description: `${cmd.description}`,
    }));
    choices.push({ value: '__back', name: '← Back', description: 'Return to main menu' });
    try {
        const selected = await Prompts.select(`Select a ${config.targetCLI} command:`, choices);
        if (selected === '__back')
            return null;
        const command = sortedCommands.find(c => c.name === selected);
        return command || null;
    }
    catch (error) {
        if (error instanceof Error && error.name === 'ExitPromptError') {
            return null;
        }
        throw error;
    }
}
async function navigateSubcommands(path, config, structure) {
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
    try {
        const selected = await Prompts.select('Select subcommand or execute:', choices);
        if (selected === '__back')
            return null;
        if (selected === '__execute')
            return path;
        return navigateSubcommands([...path, selected], config, structure);
    }
    catch (error) {
        if (error instanceof Error && error.name === 'ExitPromptError') {
            return null;
        }
        throw error;
    }
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
async function discoverGenericCLI(cliName, spinner) {
    const executor = new UniversalCLIExecutor(cliName);
    const parser = new HelpParser();
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
        }
        catch {
            continue;
        }
    }
    if (!helpText) {
        return {
            commands: [],
            subcommands: new Map(),
            telemetry: { subcommands: {}, probes: [] },
            timestamp: Date.now(),
        };
    }
    const parsed = parser.parse(helpText);
    const commands = parsed.commands
        .filter(cmd => cmd.confidence >= 0.35)
        .map(cmd => ({
        name: cmd.name,
        description: cmd.description,
        category: 'basic',
        hasSubcommands: false,
        confidence: cmd.confidence,
    }));
    const subcommands = new Map();
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
                    command.hasSubcommands = true;
                }
            }
        }
        catch {
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
//# sourceMappingURL=explore.js.map