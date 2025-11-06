import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { DEFAULT_CONFIG, isLegacyConfig, migrateLegacyConfig } from '../types/config.js';
export function getConfigDir() {
    return path.join(os.homedir(), '.climb');
}
function getLegacyConfigDir() {
    return path.join(os.homedir(), '.junglectl');
}
export function getConfigFilePath() {
    return path.join(getConfigDir(), 'config.json');
}
export async function ensureConfigDir() {
    try {
        await fs.mkdir(getConfigDir(), { recursive: true });
    }
    catch (error) {
        if (error.code !== 'EEXIST') {
            throw error;
        }
    }
}
export async function loadConfig() {
    try {
        await ensureConfigDir();
        const configPath = getConfigFilePath();
        let configExists = false;
        try {
            await fs.access(configPath);
            configExists = true;
        }
        catch {
        }
        if (!configExists) {
            const legacyPath = path.join(getLegacyConfigDir(), 'config.json');
            try {
                await fs.access(legacyPath);
                const legacyData = await fs.readFile(legacyPath, 'utf-8');
                const legacyConfig = JSON.parse(legacyData);
                if (isLegacyConfig(legacyConfig)) {
                    const migratedConfig = migrateLegacyConfig(legacyConfig);
                    await saveConfig(migratedConfig);
                    return migratedConfig;
                }
            }
            catch {
            }
            return DEFAULT_CONFIG;
        }
        const data = await fs.readFile(configPath, 'utf-8');
        const userConfig = JSON.parse(data);
        if (isLegacyConfig(userConfig)) {
            const migratedConfig = migrateLegacyConfig(userConfig);
            await saveConfig(migratedConfig);
            return migratedConfig;
        }
        return mergeConfig(DEFAULT_CONFIG, userConfig);
    }
    catch (error) {
        if (error.code === 'ENOENT') {
            return DEFAULT_CONFIG;
        }
        console.error('Warning: Failed to load config file, using defaults');
        console.error(error.message);
        return DEFAULT_CONFIG;
    }
}
export async function saveConfig(config) {
    try {
        await ensureConfigDir();
        const validated = validateConfig(config);
        const configPath = getConfigFilePath();
        await fs.writeFile(configPath, JSON.stringify(validated, null, 2) + '\n', 'utf-8');
    }
    catch (error) {
        throw new Error(`Failed to save configuration: ${error.message}`);
    }
}
export function validateConfig(config) {
    const errors = [];
    if (config.targetCLI) {
        if (typeof config.targetCLI !== 'string' || config.targetCLI.trim().length === 0) {
            errors.push('Target CLI must be a non-empty string');
        }
    }
    if (config.defaultArgs) {
        if (!Array.isArray(config.defaultArgs)) {
            errors.push('Default args must be an array');
        }
        else {
            for (const arg of config.defaultArgs) {
                if (typeof arg !== 'string') {
                    errors.push('All default args must be strings');
                    break;
                }
            }
        }
    }
    if (config.cacheTTL) {
        for (const [key, value] of Object.entries(config.cacheTTL)) {
            if (typeof value !== 'number' || value < 1000 || value > 600000) {
                errors.push(`Cache TTL for ${key} must be between 1 and 600 seconds (1000-600000ms)`);
            }
        }
    }
    if (config.timeout) {
        if (config.timeout.default) {
            if (config.timeout.default < 1000 || config.timeout.default > 300000) {
                errors.push('Default timeout must be between 1 and 300 seconds');
            }
        }
        if (config.timeout.introspection) {
            if (config.timeout.introspection < 1000 || config.timeout.introspection > 60000) {
                errors.push('Introspection timeout must be between 1 and 60 seconds');
            }
        }
        if (config.timeout.execute) {
            if (config.timeout.execute < 1000 || config.timeout.execute > 300000) {
                errors.push('Execute timeout must be between 1 and 300 seconds');
            }
        }
    }
    if (config.execution) {
        if (config.execution.maxHistorySize !== undefined) {
            if (typeof config.execution.maxHistorySize !== 'number' || config.execution.maxHistorySize < 0 || config.execution.maxHistorySize > 1000) {
                errors.push('Max history size must be between 0 and 1000');
            }
        }
    }
    if (config.theme?.primaryColor) {
        const validColors = ['blue', 'green', 'cyan', 'magenta', 'yellow'];
        if (!validColors.includes(config.theme.primaryColor)) {
            errors.push(`Primary color must be one of: ${validColors.join(', ')}`);
        }
    }
    if (errors.length > 0) {
        throw new Error(`Configuration validation failed:\n${errors.map(e => `  • ${e}`).join('\n')}`);
    }
    return mergeConfig(DEFAULT_CONFIG, config);
}
function mergeConfig(defaults, user) {
    return {
        version: user.version || defaults.version,
        targetCLI: user.targetCLI || defaults.targetCLI,
        cliPath: user.cliPath,
        defaultArgs: user.defaultArgs || defaults.defaultArgs,
        cacheTTL: {
            ...defaults.cacheTTL,
            ...(user.cacheTTL || {}),
        },
        theme: {
            ...defaults.theme,
            ...(user.theme || {}),
        },
        timeout: {
            ...defaults.timeout,
            ...(user.timeout || {}),
        },
        execution: {
            ...defaults.execution,
            ...(user.execution || {}),
        },
        registryUrl: user.registryUrl,
    };
}
export async function isFirstRun() {
    try {
        await fs.access(getConfigFilePath());
        return false;
    }
    catch {
        return true;
    }
}
export async function resetConfig() {
    const config = { ...DEFAULT_CONFIG };
    await saveConfig(config);
    return config;
}
//# sourceMappingURL=config.js.map