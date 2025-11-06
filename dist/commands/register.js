import { Prompts } from '../ui/prompts.js';
import { Formatters } from '../ui/formatters.js';
import { Spinner } from '../ui/spinners.js';
import { MCPJungleExecutor } from '../core/executor.js';
import { cache } from '../core/cache.js';
import chalk from 'chalk';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { formatNavigationHint } from '../ui/keyboard-handler.js';
const executor = new MCPJungleExecutor();
export async function registerServerInteractive(registryUrl) {
    console.log(Formatters.header('Register New MCP Server'));
    console.log();
    process.stdout.write(formatNavigationHint('navigation'));
    try {
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
        console.log(chalk.bold('\n🚀 Transport Configuration\n'));
        const transport = await Prompts.selectTransport();
        let config;
        if (transport === 'streamable_http') {
            config = await configureHttpServer(name, description);
        }
        else if (transport === 'stdio') {
            config = await configureStdioServer(name, description);
        }
        else {
            config = await configureSseServer(name, description);
        }
        console.log(chalk.bold('\n📋 Review Configuration\n'));
        console.log(Formatters.prettyJson(config));
        const confirmed = await Prompts.confirm('\nRegister this server?', true);
        if (!confirmed) {
            console.log(chalk.yellow('\n✗ Registration cancelled'));
            return;
        }
        await registerServer(config, registryUrl);
        console.log(chalk.green(`\n✓ Server "${name}" registered successfully!`));
        console.log(chalk.gray(`\nYou can now:`));
        console.log(chalk.gray(`  • List tools: mcpjungle list tools --server ${name}`));
        console.log(chalk.gray(`  • View in climb: Browse Tools menu\n`));
    }
    catch (error) {
        if (error instanceof Error) {
            console.error(Formatters.error(error.message));
        }
        throw error;
    }
}
async function configureHttpServer(name, description) {
    const url = await Prompts.textInput('Server URL', {
        required: true,
        validate: (value) => {
            try {
                const parsed = new URL(value);
                if (!['http:', 'https:'].includes(parsed.protocol)) {
                    return 'URL must use http:// or https:// protocol';
                }
                return true;
            }
            catch {
                return 'Invalid URL format';
            }
        },
    });
    const needsAuth = await Prompts.confirm('Does this server require authentication?', false);
    let bearerToken;
    if (needsAuth) {
        bearerToken = await Prompts.textInput('Bearer token / API key', {
            required: true,
        });
    }
    const config = {
        name,
        transport: 'streamable_http',
        url,
    };
    if (description)
        config.description = description;
    if (bearerToken)
        config.bearer_token = bearerToken;
    return config;
}
async function configureStdioServer(name, description) {
    console.log(chalk.gray('\nSTDIO servers are run as subprocesses (e.g., npx, uvx commands)\n'));
    const command = await Prompts.textInput('Command', {
        required: true,
        default: 'npx',
    });
    const argsInput = await Prompts.textInput('Arguments (space-separated)', {
        required: true,
    });
    const args = parseArguments(argsInput);
    const needsEnv = await Prompts.confirm('Add environment variables?', false);
    let env;
    if (needsEnv) {
        env = await buildEnvVars();
    }
    const config = {
        name,
        transport: 'stdio',
        command,
        args,
    };
    if (description)
        config.description = description;
    if (env && Object.keys(env).length > 0)
        config.env = env;
    return config;
}
async function configureSseServer(name, description) {
    console.log(chalk.yellow('\n⚠ SSE transport is experimental and may not be fully supported\n'));
    const url = await Prompts.textInput('Server URL', {
        required: true,
        validate: (value) => {
            try {
                new URL(value);
                return true;
            }
            catch {
                return 'Invalid URL format';
            }
        },
    });
    const config = {
        name,
        transport: 'sse',
        url,
    };
    if (description)
        config.description = description;
    return config;
}
async function buildEnvVars() {
    const env = {};
    console.log(chalk.gray('\nEnter environment variables (press Enter with empty key to finish)\n'));
    while (true) {
        const key = await Prompts.textInput('Variable name (blank to finish)', {
            required: false,
        });
        if (!key.trim())
            break;
        const value = await Prompts.textInput(`Value for ${chalk.cyan(key)}`, {
            required: true,
        });
        env[key] = value;
        console.log(chalk.green(`  ✓ Added ${key}=${value.slice(0, 20)}${value.length > 20 ? '...' : ''}`));
    }
    return env;
}
function parseArguments(input) {
    const args = [];
    let current = '';
    let inQuotes = false;
    let quoteChar = '';
    for (let i = 0; i < input.length; i++) {
        const char = input[i];
        if ((char === '"' || char === "'") && !inQuotes) {
            inQuotes = true;
            quoteChar = char;
        }
        else if (char === quoteChar && inQuotes) {
            inQuotes = false;
            quoteChar = '';
        }
        else if (char === ' ' && !inQuotes) {
            if (current) {
                args.push(current);
                current = '';
            }
        }
        else {
            current += char;
        }
    }
    if (current) {
        args.push(current);
    }
    return args.filter(arg => arg.trim());
}
async function registerServer(config, registryUrl) {
    const spinner = new Spinner();
    spinner.start('Registering server...');
    try {
        const tempDir = os.tmpdir();
        const tempFile = path.join(tempDir, `mcpjungle-${Date.now()}.json`);
        await fs.writeFile(tempFile, JSON.stringify(config, null, 2), 'utf-8');
        const exec = registryUrl ? new MCPJungleExecutor(registryUrl) : executor;
        await exec.execute(['register', '-c', tempFile], {
            timeout: 15000,
        });
        await fs.unlink(tempFile).catch(() => {
        });
        cache.invalidate('servers');
        cache.invalidate('tools');
        spinner.succeed('Server registered');
    }
    catch (error) {
        spinner.fail('Registration failed');
        throw error;
    }
}
//# sourceMappingURL=register.js.map