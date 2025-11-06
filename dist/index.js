#!/usr/bin/env node
import { Prompts } from './ui/prompts.js';
import { Formatters } from './ui/formatters.js';
import { UniversalCLIExecutor } from './core/executor.js';
import { OutputParser } from './core/parser.js';
import { registerServerInteractive } from './commands/register.js';
import { browseInteractive } from './commands/list.js';
import { invokeToolInteractive } from './commands/invoke.js';
import { groupsMenuInteractive } from './commands/groups.js';
import { enableDisableMenuInteractive } from './commands/enable-disable.js';
import { settingsMenuInteractive } from './commands/settings.js';
import { loadConfig, saveConfig, isFirstRun, getConfigFilePath } from './core/config.js';
import { CLIIntrospector } from './core/introspection.js';
import { DynamicMenuBuilder } from './core/menu-builder.js';
import chalk from 'chalk';
async function showWelcomeIfFirstRun() {
    if (await isFirstRun()) {
        console.log(chalk.cyan.bold('\n  🧗 Welcome to climb!\n'));
        console.log(chalk.gray('  Universal CLI explorer - works with git, docker, npm, and more'));
        console.log(chalk.gray(`  Config: ${getConfigFilePath()}\n`));
        console.log(chalk.gray('  You can change settings anytime from the main menu.\n'));
    }
}
async function mainMenu() {
    let config;
    try {
        config = await loadConfig();
        if (await isFirstRun()) {
            await saveConfig(config);
            await showWelcomeIfFirstRun();
            await new Promise(resolve => setTimeout(resolve, 2000));
        }
    }
    catch (error) {
        console.error(Formatters.error('Failed to load configuration'));
        console.error(error.message);
        console.log(chalk.gray('\nUsing default configuration...\n'));
        const { DEFAULT_CONFIG } = await import('./types/config.js');
        config = DEFAULT_CONFIG;
    }
    const isAvailable = UniversalCLIExecutor.isAvailable(config.targetCLI);
    if (!isAvailable) {
        console.log(Formatters.warning(`Target CLI '${config.targetCLI}' not found in PATH`));
        console.log(chalk.gray('\nWould you like to switch to a different CLI?\n'));
        const shouldSwitch = await Prompts.confirm('Switch CLI?', true);
        if (shouldSwitch) {
            const { switchCLIInteractive } = await import('./commands/switch-cli.js');
            config = await switchCLIInteractive(config);
            await saveConfig(config);
        }
        else {
            console.log(chalk.gray('\nContinuing with current configuration...\n'));
        }
    }
    let serverStatus;
    if (config.targetCLI === 'mcpjungle') {
        const registryUrl = config.registryUrl || 'http://127.0.0.1:8080';
        const executor = new UniversalCLIExecutor('mcpjungle', config.defaultArgs);
        try {
            const result = await executor.execute(['version'], { timeout: 3000 });
            serverStatus = OutputParser.parseServerStatus(result.stdout, registryUrl);
        }
        catch {
            serverStatus = {
                connected: false,
                url: registryUrl,
            };
        }
    }
    console.clear();
    console.log(chalk.cyan.bold('\n  🧗 climb v2.0.0\n'));
    console.log(chalk.gray(`  Exploring: ${chalk.cyan(config.targetCLI)}`));
    if (serverStatus) {
        console.log('  ' + Formatters.statusBar(serverStatus));
    }
    console.log();
    if (config.targetCLI === 'mcpjungle' && serverStatus && !serverStatus.connected) {
        console.log(Formatters.warning('Cannot connect to MCPJungle server'));
        console.log(chalk.gray('\nMake sure the server is running:'));
        console.log(chalk.gray('  docker compose up -d'));
        console.log(chalk.gray('  or: mcpjungle start\n'));
        const shouldContinue = await Prompts.confirm('Continue anyway?', false);
        if (!shouldContinue) {
            process.exit(0);
        }
    }
    while (true) {
        try {
            console.log(chalk.gray('Use arrow keys to navigate, ESC to stay in menu, Ctrl+C to exit\n'));
            let menuChoices;
            let introspector;
            if (config.targetCLI === 'mcpjungle') {
                introspector = new CLIIntrospector();
                const menuBuilder = new DynamicMenuBuilder(config);
                try {
                    menuChoices = await menuBuilder.buildMainMenu();
                }
                catch {
                    menuChoices = [
                        { value: 'list', name: '📋 Browse Resources', description: 'View servers, tools, groups, prompts' },
                        { value: 'invoke', name: '🔧 Invoke Tool', description: 'Execute tool with interactive input' },
                        { value: 'register', name: '➕ Register MCP Server', description: 'Add a new MCP server to the registry' },
                        { value: 'create', name: '✨ Create', description: 'Create groups and other entities' },
                        { value: 'enable', name: '✅ Enable', description: 'Enable tools and servers' },
                        { value: 'disable', name: '❌ Disable', description: 'Disable tools and servers' },
                        { value: 'settings', name: '⚙️  Settings', description: 'Configure climb' },
                        { value: 'exit', name: '❌ Exit', description: 'Quit climb' },
                    ];
                }
            }
            else {
                menuChoices = [
                    { value: 'explore', name: '🔍 Explore Commands', description: `Navigate and execute ${config.targetCLI} commands` },
                    { value: 'history', name: '📜 History', description: 'View command execution history' },
                    { value: 'switch', name: '🔄 Switch CLI', description: 'Change to a different CLI tool' },
                    { value: 'settings', name: '⚙️  Settings', description: 'Configure climb preferences' },
                    { value: 'exit', name: '❌ Exit', description: 'Quit climb' },
                ];
            }
            if (introspector && config.targetCLI === 'mcpjungle') {
                const telemetry = introspector.getTelemetry();
                if (telemetry.root) {
                    const avgCmd = Math.round(telemetry.root.averageCommandConfidence * 100);
                    const avgOpt = Math.round(telemetry.root.averageOptionConfidence * 100);
                    const sections = telemetry.root.sectionsDetected;
                    console.log(chalk.gray(`Parser confidence • commands ${avgCmd}% · options ${avgOpt}% · sections ${sections}`));
                    const warning = telemetry.root.warnings[0];
                    if (warning) {
                        console.log(chalk.gray(`⚠️  ${warning}`));
                    }
                    if (Object.keys(telemetry.subcommands).length > 0) {
                        const explored = Object.keys(telemetry.subcommands).length;
                        console.log(chalk.gray(`Explored ${explored} subcommand scopes`));
                    }
                    console.log();
                }
            }
            const action = await Prompts.select('What would you like to do?', menuChoices);
            console.log();
            switch (action) {
                case 'explore': {
                    const { exploreCommandsInteractive } = await import('./commands/explore.js');
                    await exploreCommandsInteractive(config);
                    break;
                }
                case 'history': {
                    const { historyBrowserInteractive } = await import('./commands/history.js');
                    await historyBrowserInteractive(config);
                    break;
                }
                case 'switch': {
                    const { switchCLIInteractive } = await import('./commands/switch-cli.js');
                    config = await switchCLIInteractive(config);
                    await saveConfig(config);
                    console.clear();
                    break;
                }
                case 'settings':
                    config = await settingsMenuInteractive(config);
                    break;
                case 'exit':
                    console.log(chalk.cyan('\n👋 Goodbye!\n'));
                    process.exit(0);
                case 'list':
                    if (config.targetCLI === 'mcpjungle') {
                        await browseInteractive(config.registryUrl);
                    }
                    break;
                case 'invoke':
                    if (config.targetCLI === 'mcpjungle') {
                        await invokeToolInteractive(config.registryUrl);
                    }
                    break;
                case 'register':
                    if (config.targetCLI === 'mcpjungle') {
                        await registerServerInteractive(config.registryUrl);
                    }
                    break;
                case 'create':
                    if (config.targetCLI === 'mcpjungle') {
                        await groupsMenuInteractive(config.registryUrl);
                    }
                    break;
                case 'enable':
                case 'disable':
                    if (config.targetCLI === 'mcpjungle') {
                        await enableDisableMenuInteractive(config.registryUrl);
                    }
                    break;
                case 'browse':
                    if (config.targetCLI === 'mcpjungle') {
                        await browseInteractive(config.registryUrl);
                    }
                    break;
                case 'groups':
                    if (config.targetCLI === 'mcpjungle') {
                        await groupsMenuInteractive(config.registryUrl);
                    }
                    break;
                case 'enable-disable':
                    if (config.targetCLI === 'mcpjungle') {
                        await enableDisableMenuInteractive(config.registryUrl);
                    }
                    break;
                default:
                    console.log(Formatters.warning(`Command "${action}" not yet implemented`));
                    await Prompts.confirm('Press Enter to continue', true);
            }
            console.clear();
            console.log(chalk.cyan.bold('\n  🧗 climb v2.0.0\n'));
            console.log(chalk.gray(`  Exploring: ${chalk.cyan(config.targetCLI)}`));
            if (serverStatus) {
                console.log('  ' + Formatters.statusBar(serverStatus));
            }
            console.log();
        }
        catch (error) {
            if (error instanceof Error) {
                if (error.name === 'ExitPromptError') {
                    console.log();
                    console.log(chalk.gray('ESC pressed - staying in main menu'));
                    console.log(chalk.gray('Use Ctrl+C to exit, or select Exit from menu\n'));
                    continue;
                }
                console.error('\n' + Formatters.error(error.message));
                await Prompts.confirm('\nPress Enter to continue', true);
            }
            else {
                throw error;
            }
        }
    }
}
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
process.on('SIGINT', () => {
    console.log(chalk.cyan('\n\n👋 Goodbye!\n'));
    process.exit(0);
});
mainMenu().catch((error) => {
    console.error('\n' + Formatters.error('Fatal error:'));
    console.error(error.message);
    process.exit(1);
});
//# sourceMappingURL=index.js.map