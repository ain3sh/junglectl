/**
 * Configuration Management
 * Handles loading, saving, and validating user configuration
 */

import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import type { AppConfig } from '../types/config.js';
import { DEFAULT_CONFIG } from '../types/config.js';

/**
 * Get the configuration directory path
 */
export function getConfigDir(): string {
  return path.join(os.homedir(), '.climb');
}

/**
 * Get the configuration file path
 */
export function getConfigFilePath(): string {
  return path.join(getConfigDir(), 'config.json');
}

/**
 * Ensure configuration directory exists
 */
export async function ensureConfigDir(): Promise<void> {
  try {
    await fs.mkdir(getConfigDir(), { recursive: true });
  } catch (error) {
    // Ignore if directory already exists
    if ((error as NodeJS.ErrnoException).code !== 'EEXIST') {
      throw error;
    }
  }
}

/**
 * Load configuration from file
 * Returns defaults if file doesn't exist
 */
export async function loadConfig(): Promise<AppConfig> {
  try {
    await ensureConfigDir();
    const configPath = getConfigFilePath();

    // Try to read config file
    const data = await fs.readFile(configPath, 'utf-8');
    const userConfig = JSON.parse(data);

    // Validate and merge with defaults
    return mergeConfig(DEFAULT_CONFIG, userConfig);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      // File doesn't exist - first run
      return DEFAULT_CONFIG;
    }

    // JSON parse error or other error
    console.error('Warning: Failed to load config file, using defaults');
    console.error((error as Error).message);
    return DEFAULT_CONFIG;
  }
}

/**
 * Save configuration to file
 */
export async function saveConfig(config: AppConfig): Promise<void> {
  try {
    await ensureConfigDir();
    
    // Validate config before saving
    const validated = validateConfig(config);

    const configPath = getConfigFilePath();
    
    // Write with pretty formatting
    await fs.writeFile(
      configPath,
      JSON.stringify(validated, null, 2) + '\n',
      'utf-8'
    );
  } catch (error) {
    throw new Error(`Failed to save configuration: ${(error as Error).message}`);
  }
}

/**
 * Validate configuration
 * Throws error if invalid
 */
export function validateConfig(config: Partial<AppConfig>): AppConfig {
  const errors: string[] = [];

  // Validate targetCLI
  if (config.targetCLI) {
    if (typeof config.targetCLI !== 'string' || config.targetCLI.trim().length === 0) {
      errors.push('Target CLI must be a non-empty string');
    }
  }

  // Validate defaultArgs
  if (config.defaultArgs) {
    if (!Array.isArray(config.defaultArgs)) {
      errors.push('Default args must be an array');
    } else {
      for (const arg of config.defaultArgs) {
        if (typeof arg !== 'string') {
          errors.push('All default args must be strings');
          break;
        }
      }
    }
  }

  // Validate cache TTLs
  if (config.cacheTTL) {
    for (const [key, value] of Object.entries(config.cacheTTL)) {
      if (typeof value !== 'number' || value < 1000 || value > 600000) {
        errors.push(`Cache TTL for ${key} must be between 1 and 600 seconds (1000-600000ms)`);
      }
    }
  }

  // Validate timeouts
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

  // Validate execution settings
  if (config.execution) {
    if (config.execution.maxHistorySize !== undefined) {
      if (typeof config.execution.maxHistorySize !== 'number' || config.execution.maxHistorySize < 0 || config.execution.maxHistorySize > 1000) {
        errors.push('Max history size must be between 0 and 1000');
      }
    }
  }

  // Validate theme color
  if (config.theme?.primaryColor) {
    const validColors = ['blue', 'green', 'cyan', 'magenta', 'yellow'];
    if (!validColors.includes(config.theme.primaryColor)) {
      errors.push(`Primary color must be one of: ${validColors.join(', ')}`);
    }
  }

  if (errors.length > 0) {
    throw new Error(`Configuration validation failed:\n${errors.map(e => `  • ${e}`).join('\n')}`);
  }

  // Return merged with defaults
  return mergeConfig(DEFAULT_CONFIG, config);
}

/**
 * Merge user config with defaults
 * User config values override defaults
 */
function mergeConfig(defaults: AppConfig, user: Partial<AppConfig>): AppConfig {
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
    registryUrl: user.registryUrl, // MCPJungle-specific (optional)
  };
}

/**
 * Check if this is the first run (config file doesn't exist)
 */
export async function isFirstRun(): Promise<boolean> {
  try {
    await fs.access(getConfigFilePath());
    return false;
  } catch {
    return true;
  }
}

/**
 * Reset configuration to defaults
 */
export async function resetConfig(): Promise<AppConfig> {
  const config = { ...DEFAULT_CONFIG };
  await saveConfig(config);
  return config;
}
