import { Prompts } from '../ui/prompts.js';
import { Formatters } from '../ui/formatters.js';
import { saveConfig, getConfigFilePath, resetConfig } from '../core/config.js';
import { DEFAULT_CONFIG } from '../types/config.js';
import { formatError } from '../utils/errors.js';
import chalk from 'chalk';
export async function settingsMenuInteractive(config) {
    let currentConfig = { ...config };
    while (true) {
        try {
            console.log(chalk.gray('Press ESC to go back\n'));
            const settingsChoices = [
                { value: 'view', name: '👁️  View Configuration', description: 'Display current settings' },
                { value: 'cli', name: '🔄 Switch CLI', description: 'Change target CLI tool' },
            ];
            if (currentConfig.targetCLI === 'mcpjungle') {
                settingsChoices.push({
                    value: 'registry',
                    name: '🔗 Edit Registry URL',
                    description: 'Change MCPJungle server URL',
                });
            }
            settingsChoices.push({ value: 'cache', name: '⏱️  Edit Cache Settings', description: 'Configure cache TTL values' }, { value: 'theme', name: '🎨 Edit Theme', description: 'Customize colors and appearance' }, { value: 'timeout', name: '⏲️  Edit Timeouts', description: 'Configure operation timeouts' }, { value: 'reset', name: '🔄 Reset to Defaults', description: 'Restore default settings' }, { value: 'back', name: '← Back', description: 'Return to main menu' });
            const action = await Prompts.select('Settings', settingsChoices);
            if (action === 'back')
                break;
            try {
                switch (action) {
                    case 'view':
                        await viewConfig(currentConfig);
                        break;
                    case 'cli':
                        currentConfig = await editTargetCLI(currentConfig);
                        break;
                    case 'registry':
                        currentConfig = await editRegistryUrl(currentConfig);
                        break;
                    case 'cache':
                        currentConfig = await editCacheSettings(currentConfig);
                        break;
                    case 'theme':
                        currentConfig = await editThemeSettings(currentConfig);
                        break;
                    case 'timeout':
                        currentConfig = await editTimeoutSettings(currentConfig);
                        break;
                    case 'reset':
                        currentConfig = await resetToDefaults();
                        break;
                }
                await Prompts.confirm('Continue?', true);
            }
            catch (error) {
                if (error instanceof Error && error.name === 'ExitPromptError') {
                    break;
                }
                console.error('\n' + formatError(error));
                await Prompts.confirm('Continue?', true);
            }
        }
        catch (error) {
            if (error instanceof Error && error.name === 'ExitPromptError') {
                break;
            }
            throw error;
        }
    }
    return currentConfig;
}
async function viewConfig(config) {
    console.log(Formatters.header('Current Configuration'));
    const displayConfig = {
        'Version': config.version,
        'Target CLI': config.targetCLI,
        'CLI Path': config.cliPath || '(default)',
        'Default Args': config.defaultArgs.length > 0 ? config.defaultArgs.join(' ') : '(none)',
        'Cache TTL': {
            'Structure': `${config.cacheTTL.structure / 1000}s`,
            'Output': `${config.cacheTTL.output / 1000}s`,
        },
        'Timeouts': {
            'Default': `${config.timeout.default / 1000}s`,
            'Introspection': `${config.timeout.introspection / 1000}s`,
            'Execution': `${config.timeout.execute / 1000}s`,
        },
        'Theme': {
            'Primary Color': config.theme.primaryColor,
            'Colors Enabled': config.theme.enableColors,
        },
        'Execution': {
            'Capture History': config.execution.captureHistory,
            'Max History Size': config.execution.maxHistorySize,
            'Show Confidence': config.execution.showConfidence,
        },
        ...(config.registryUrl && { 'Legacy Registry URL': config.registryUrl }),
    };
    console.log(Formatters.prettyJson(displayConfig));
    console.log(chalk.gray(`\nConfiguration file: ${getConfigFilePath()}\n`));
}
async function editTargetCLI(config) {
    const { switchCLIInteractive } = await import('./switch-cli.js');
    const updatedConfig = await switchCLIInteractive(config);
    await saveConfig(updatedConfig);
    console.log(Formatters.success('\n✓ CLI switched and config saved\n'));
    return updatedConfig;
}
async function editRegistryUrl(config) {
    console.log(Formatters.header('Edit Registry URL'));
    console.log(chalk.gray('\nCurrent URL: ') + chalk.cyan(config.registryUrl) + '\n');
    const newUrl = await Prompts.textInput('New registry URL', {
        default: config.registryUrl,
        validate: (val) => {
            try {
                const url = new URL(val);
                if (!['http:', 'https:'].includes(url.protocol)) {
                    return 'URL must use http:// or https:// protocol';
                }
                return true;
            }
            catch {
                return 'Invalid URL format (must include protocol: http:// or https://)';
            }
        },
    });
    config.registryUrl = newUrl;
    await saveConfig(config);
    console.log('\n' + Formatters.success('Registry URL updated'));
    console.log(chalk.gray('Restart required for some operations to use new URL\n'));
    return config;
}
async function editCacheSettings(config) {
    while (true) {
        const setting = await Prompts.select('Cache Settings', [
            { value: 'structure', name: `Structure Cache (currently ${config.cacheTTL.structure / 1000}s)` },
            { value: 'output', name: `Output Cache (currently ${config.cacheTTL.output / 1000}s)` },
            { value: 'all', name: 'Set All to Same Value', description: 'Update all cache TTLs at once' },
            { value: 'back', name: '← Back' },
        ]);
        if (setting === 'back')
            break;
        const seconds = await Prompts.textInput('TTL in seconds (1-600)', {
            default: String(config.cacheTTL.structure / 1000),
            validate: (val) => {
                const num = Number(val);
                if (isNaN(num))
                    return 'Must be a valid number';
                if (num < 1 || num > 600)
                    return 'Must be between 1 and 600 seconds';
                return true;
            },
        });
        const milliseconds = Number(seconds) * 1000;
        if (setting === 'all') {
            config.cacheTTL.structure = milliseconds;
            config.cacheTTL.output = milliseconds;
            console.log(Formatters.success('All cache TTLs updated'));
        }
        else {
            config.cacheTTL[setting] = milliseconds;
            console.log(Formatters.success(`${setting} cache TTL updated`));
        }
        await saveConfig(config);
    }
    return config;
}
async function editThemeSettings(config) {
    while (true) {
        const setting = await Prompts.select('Theme Settings', [
            { value: 'color', name: `Primary Color (currently ${config.theme.primaryColor})` },
            { value: 'toggle', name: `Colors ${config.theme.enableColors ? 'Enabled' : 'Disabled'}`, description: 'Toggle colors on/off' },
            { value: 'back', name: '← Back' },
        ]);
        if (setting === 'back')
            break;
        if (setting === 'color') {
            const color = await Prompts.select('Primary Color', [
                { value: 'cyan', name: 'Cyan', description: 'Default color' },
                { value: 'blue', name: 'Blue' },
                { value: 'green', name: 'Green' },
                { value: 'magenta', name: 'Magenta' },
                { value: 'yellow', name: 'Yellow' },
            ]);
            config.theme.primaryColor = color;
            console.log(Formatters.success('Primary color updated'));
        }
        else {
            config.theme.enableColors = !config.theme.enableColors;
            console.log(Formatters.success(`Colors ${config.theme.enableColors ? 'enabled' : 'disabled'}`));
        }
        await saveConfig(config);
    }
    return config;
}
async function editTimeoutSettings(config) {
    while (true) {
        const setting = await Prompts.select('Timeout Settings', [
            { value: 'default', name: `Default Timeout (currently ${config.timeout.default / 1000}s)`, description: 'For most operations' },
            { value: 'introspection', name: `Introspection Timeout (currently ${config.timeout.introspection / 1000}s)`, description: 'For help parsing' },
            { value: 'execute', name: `Execution Timeout (currently ${config.timeout.execute / 1000}s)`, description: 'For command execution' },
            { value: 'back', name: '← Back' },
        ]);
        if (setting === 'back')
            break;
        const maxSeconds = setting === 'introspection' ? 60 : 300;
        const seconds = await Prompts.textInput(`Timeout in seconds (1-${maxSeconds})`, {
            default: String(config.timeout[setting] / 1000),
            validate: (val) => {
                const num = Number(val);
                if (isNaN(num))
                    return 'Must be a valid number';
                if (num < 1 || num > maxSeconds)
                    return `Must be between 1 and ${maxSeconds} seconds`;
                return true;
            },
        });
        const milliseconds = Number(seconds) * 1000;
        config.timeout[setting] = milliseconds;
        await saveConfig(config);
        console.log(Formatters.success(`${setting} timeout updated`));
    }
    return config;
}
async function resetToDefaults() {
    console.log(Formatters.header('Reset to Defaults'));
    console.log(chalk.yellow('\n⚠ This will reset ALL settings to their default values.\n'));
    const confirmed = await Prompts.confirm('Are you sure you want to reset?', false);
    if (!confirmed) {
        console.log(chalk.yellow('\n✗ Reset cancelled'));
        return DEFAULT_CONFIG;
    }
    const newConfig = await resetConfig();
    console.log('\n' + Formatters.success('Settings reset to defaults'));
    console.log(chalk.gray('All preferences have been restored to their original values.\n'));
    return newConfig;
}
//# sourceMappingURL=settings.js.map