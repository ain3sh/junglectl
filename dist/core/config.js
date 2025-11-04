import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { DEFAULT_CONFIG } from '../types/config.js';
export function getConfigDir() {
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
        try {
            await fs.access(configPath);
        }
        catch {
            return DEFAULT_CONFIG;
        }
        const data = await fs.readFile(configPath, 'utf-8');
        const userConfig = JSON.parse(data);
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
    if (config.registryUrl) {
        try {
            const url = new URL(config.registryUrl);
            if (!['http:', 'https:'].includes(url.protocol)) {
                errors.push('Registry URL must use http:// or https:// protocol');
            }
        }
        catch {
            errors.push('Invalid registry URL format');
        }
    }
    if (config.cacheTTL) {
        for (const [key, value] of Object.entries(config.cacheTTL)) {
            if (typeof value !== 'number' || value < 1000 || value > 300000) {
                errors.push(`Cache TTL for ${key} must be between 1 and 300 seconds (1000-300000ms)`);
            }
        }
    }
    if (config.timeout) {
        if (config.timeout.default) {
            if (config.timeout.default < 1000 || config.timeout.default > 300000) {
                errors.push('Default timeout must be between 1 and 300 seconds');
            }
        }
        if (config.timeout.invoke) {
            if (config.timeout.invoke < 1000 || config.timeout.invoke > 300000) {
                errors.push('Invoke timeout must be between 1 and 300 seconds');
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
        registryUrl: user.registryUrl || defaults.registryUrl,
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
        experimental: {
            ...defaults.experimental,
            ...(user.experimental || {}),
        },
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