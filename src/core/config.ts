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
  return path.join(os.homedir(), '.junglectl');
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
    
    // Check if file exists
    try {
      await fs.access(configPath);
    } catch {
      // File doesn't exist - first run
      return DEFAULT_CONFIG;
    }

    // Read and parse config
    const data = await fs.readFile(configPath, 'utf-8');
    const userConfig = JSON.parse(data);

    // Validate and merge with defaults
    return mergeConfig(DEFAULT_CONFIG, userConfig);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      // File doesn't exist
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

  // Validate registry URL
  if (config.registryUrl) {
    try {
      const url = new URL(config.registryUrl);
      if (!['http:', 'https:'].includes(url.protocol)) {
        errors.push('Registry URL must use http:// or https:// protocol');
      }
    } catch {
      errors.push('Invalid registry URL format');
    }
  }

  // Validate cache TTLs
  if (config.cacheTTL) {
    for (const [key, value] of Object.entries(config.cacheTTL)) {
      if (typeof value !== 'number' || value < 1000 || value > 300000) {
        errors.push(`Cache TTL for ${key} must be between 1 and 300 seconds (1000-300000ms)`);
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
    if (config.timeout.invoke) {
      if (config.timeout.invoke < 1000 || config.timeout.invoke > 300000) {
        errors.push('Invoke timeout must be between 1 and 300 seconds');
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
