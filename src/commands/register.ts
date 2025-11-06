/**
 * Register Server Command
 * Interactive workflow for registering MCP servers
 */

import { Prompts } from '../ui/prompts.js';
import { Formatters } from '../ui/formatters.js';
import { Spinner } from '../ui/spinners.js';
import { MCPJungleExecutor } from '../core/executor.js';
import { cache } from '../core/cache.js';
import type { ServerConfig } from '../types/mcpjungle.js';
import chalk from 'chalk';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

const executor = new MCPJungleExecutor();

export async function registerServerInteractive(registryUrl?: string): Promise<void> {
  console.log(Formatters.header('Register New MCP Server'));

  try {
    // Step 1: Basic Information
    console.log(chalk.bold('\n📝 Basic Information\n'));

    const name = await Prompts.textInput('Server name', {
      required: true,
      validate: (value) => {
        if (!/^[a-zA-Z0-9_-]+$/.test(value)) {
          return 'Name must be alphanumeric (underscores and hyphens allowed, no spaces)';
        }
        if (value.includes('__')) {
          return 'Name cannot contain double underscores (__)';
        }
        return true;
      },
    });

    const description = await Prompts.textInput('Description (optional)', {
      required: false,
    });

    // Step 2: Transport Selection
    console.log(chalk.bold('\n🚀 Transport Configuration\n'));
    const transport = await Prompts.selectTransport();

    // Step 3: Transport-specific configuration
    let config: ServerConfig;

    if (transport === 'streamable_http') {
      config = await configureHttpServer(name, description);
    } else if (transport === 'stdio') {
      config = await configureStdioServer(name, description);
    } else {
      config = await configureSseServer(name, description);
    }

    // Step 4: Confirm and register
    console.log(chalk.bold('\n📋 Review Configuration\n'));
    console.log(Formatters.prettyJson(config));

    const confirmed = await Prompts.confirm('\nRegister this server?', true);

    if (!confirmed) {
      console.log(chalk.yellow('\n✗ Registration cancelled'));
      return;
    }

    // Execute registration
    await registerServer(config, registryUrl);

    console.log(chalk.green(`\n✓ Server "${name}" registered successfully!`));
    console.log(chalk.gray(`\nYou can now:`));
    console.log(chalk.gray(`  • List tools: mcpjungle list tools --server ${name}`));
    console.log(chalk.gray(`  • View in JungleCTL: Browse Tools menu\n`));

  } catch (error) {
    if (error instanceof Error) {
      console.error(Formatters.error(error.message));
    }
    throw error;
  }
}

/**
 * Configure HTTP/HTTPS server
 */
async function configureHttpServer(
  name: string,
  description?: string
): Promise<ServerConfig> {
  const url = await Prompts.textInput('Server URL', {
    required: true,
    validate: (value) => {
      try {
        const parsed = new URL(value);
        if (!['http:', 'https:'].includes(parsed.protocol)) {
          return 'URL must use http:// or https:// protocol';
        }
        return true;
      } catch {
        return 'Invalid URL format';
      }
    },
  });

  const needsAuth = await Prompts.confirm('Does this server require authentication?', false);

  let bearerToken: string | undefined;
  if (needsAuth) {
    bearerToken = await Prompts.textInput('Bearer token / API key', {
      required: true,
    });
  }

  const config: ServerConfig = {
    name,
    transport: 'streamable_http',
    url,
  };

  if (description) config.description = description;
  if (bearerToken) config.bearer_token = bearerToken;

  return config;
}

/**
 * Configure STDIO server
 */
async function configureStdioServer(
  name: string,
  description?: string
): Promise<ServerConfig> {
  console.log(chalk.gray('\nSTDIO servers are run as subprocesses (e.g., npx, uvx commands)\n'));

  const command = await Prompts.textInput('Command', {
    required: true,
    default: 'npx',
  });

  const argsInput = await Prompts.textInput('Arguments (space-separated)', {
    required: true,
  });

  // Parse arguments, respecting quotes
  const args = parseArguments(argsInput);

  const needsEnv = await Prompts.confirm('Add environment variables?', false);

  let env: Record<string, string> | undefined;
  if (needsEnv) {
    env = await buildEnvVars();
  }

  const config: ServerConfig = {
    name,
    transport: 'stdio',
    command,
    args,
  };

  if (description) config.description = description;
  if (env && Object.keys(env).length > 0) config.env = env;

  return config;
}

/**
 * Configure SSE server
 */
async function configureSseServer(
  name: string,
  description?: string
): Promise<ServerConfig> {
  console.log(chalk.yellow('\n⚠ SSE transport is experimental and may not be fully supported\n'));

  const url = await Prompts.textInput('Server URL', {
    required: true,
    validate: (value) => {
      try {
        new URL(value);
        return true;
      } catch {
        return 'Invalid URL format';
      }
    },
  });

  const config: ServerConfig = {
    name,
    transport: 'sse',
    url,
  };

  if (description) config.description = description;

  return config;
}

/**
 * Build environment variables interactively
 */
async function buildEnvVars(): Promise<Record<string, string>> {
  const env: Record<string, string> = {};

  console.log(chalk.gray('\nEnter environment variables (press Enter with empty key to finish)\n'));

  while (true) {
    const key = await Prompts.textInput('Variable name (blank to finish)', {
      required: false,
    });

    if (!key.trim()) break;

    const value = await Prompts.textInput(`Value for ${chalk.cyan(key)}`, {
      required: true,
    });

    env[key] = value;
    console.log(chalk.green(`  ✓ Added ${key}=${value.slice(0, 20)}${value.length > 20 ? '...' : ''}`));
  }

  return env;
}

/**
 * Parse command arguments, respecting quotes
 */
function parseArguments(input: string): string[] {
  const args: string[] = [];
  let current = '';
  let inQuotes = false;
  let quoteChar = '';

  for (let i = 0; i < input.length; i++) {
    const char = input[i];

    if ((char === '"' || char === "'") && !inQuotes) {
      inQuotes = true;
      quoteChar = char;
    } else if (char === quoteChar && inQuotes) {
      inQuotes = false;
      quoteChar = '';
    } else if (char === ' ' && !inQuotes) {
      if (current) {
        args.push(current);
        current = '';
      }
    } else {
      current += char;
    }
  }

  if (current) {
    args.push(current);
  }

  return args.filter(arg => arg.trim());
}

/**
 * Execute server registration
 */
async function registerServer(config: ServerConfig, registryUrl?: string): Promise<void> {
  const spinner = new Spinner();
  spinner.start('Registering server...');

  try {
    // Write config to temp file
    const tempDir = os.tmpdir();
    const tempFile = path.join(tempDir, `mcpjungle-${Date.now()}.json`);

    await fs.writeFile(tempFile, JSON.stringify(config, null, 2), 'utf-8');

    // Create executor with registry URL if provided (legacy MCP support)
    const exec = registryUrl ? new MCPJungleExecutor(registryUrl) : executor;

    // Execute registration
    await exec.execute(['register', '-c', tempFile], {
      timeout: 15000,
    });

    // Clean up temp file
    await fs.unlink(tempFile).catch(() => {
      // Ignore cleanup errors
    });

    // Invalidate cache
    cache.invalidate('servers');
    cache.invalidate('tools');

    spinner.succeed('Server registered');
  } catch (error) {
    spinner.fail('Registration failed');
    throw error;
  }
}
