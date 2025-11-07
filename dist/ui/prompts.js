import { input, confirm, checkbox } from '@inquirer/prompts';
import search from '@inquirer/search';
import customSelect from './custom-select.js';
import { cache } from '../core/cache.js';
import { MCPJungleExecutor } from '../core/executor.js';
import { OutputParser } from '../core/parser.js';
import chalk from 'chalk';
const executor = new MCPJungleExecutor();
export class Prompts {
    static async selectServer(message = 'Select a server', registryUrl) {
        const exec = registryUrl ? new MCPJungleExecutor(registryUrl) : executor;
        const servers = await cache.get('servers', async () => {
            try {
                const result = await exec.execute(['list', 'servers']);
                return OutputParser.parseServers(result.stdout);
            }
            catch {
                return [];
            }
        });
        if (servers.length === 0) {
            throw new Error('No servers registered. Please register a server first.');
        }
        return search({
            message,
            source: async (input) => {
                const filtered = input
                    ? servers.filter(s => s.name.toLowerCase().includes(input.toLowerCase()) ||
                        (s.description && s.description.toLowerCase().includes(input.toLowerCase())))
                    : servers;
                return filtered.map(s => ({
                    value: s.name,
                    name: s.name,
                    description: s.description || `${s.transport} server`,
                }));
            },
        });
    }
    static async selectTool(message = 'Select a tool', serverFilter, registryUrl) {
        const exec = registryUrl ? new MCPJungleExecutor(registryUrl) : executor;
        const cacheKey = serverFilter ? `tools_${serverFilter}` : 'tools';
        const tools = await cache.get(cacheKey, async () => {
            try {
                const args = ['list', 'tools'];
                if (serverFilter)
                    args.push('--server', serverFilter);
                const result = await exec.execute(args);
                return OutputParser.parseTools(result.stdout);
            }
            catch {
                return [];
            }
        });
        if (tools.length === 0) {
            throw new Error(serverFilter
                ? `No tools found for server "${serverFilter}"`
                : 'No tools available');
        }
        return search({
            message,
            source: async (input) => {
                const filtered = input
                    ? tools.filter(t => t.canonicalName.toLowerCase().includes(input.toLowerCase()) ||
                        (t.description && t.description.toLowerCase().includes(input.toLowerCase())))
                    : tools;
                return filtered.map(t => ({
                    value: t.canonicalName,
                    name: t.canonicalName,
                    description: t.description || `Tool from ${t.serverName}`,
                }));
            },
        });
    }
    static async selectTransport() {
        return customSelect({
            message: 'Select transport type',
            choices: [
                {
                    value: 'streamable_http',
                    name: chalk.cyan('🌐 Streamable HTTP'),
                    description: 'For HTTP-based MCP servers (remote or local HTTP endpoints)',
                },
                {
                    value: 'stdio',
                    name: chalk.green('🖥️  STDIO'),
                    description: 'For npx/uvx-based servers (runs as subprocess)',
                },
                {
                    value: 'sse',
                    name: chalk.yellow('📡 SSE (Experimental)'),
                    description: 'Server-sent events transport (not fully supported)',
                },
            ],
            loop: false,
        });
    }
    static async selectMultipleTools(message = 'Select tools to include', registryUrl) {
        const exec = registryUrl ? new MCPJungleExecutor(registryUrl) : executor;
        const tools = await cache.get('tools', async () => {
            try {
                const result = await exec.execute(['list', 'tools']);
                return OutputParser.parseTools(result.stdout);
            }
            catch {
                return [];
            }
        });
        if (tools.length === 0) {
            return [];
        }
        const result = await checkbox({
            message: `${message} (${tools.length} available)`,
            choices: tools.map(t => ({
                value: t.canonicalName,
                name: t.canonicalName,
                description: t.description,
            })),
            pageSize: 15,
        });
        return result;
    }
    static async selectMultipleServers(message = 'Select servers to include', registryUrl) {
        const exec = registryUrl ? new MCPJungleExecutor(registryUrl) : executor;
        const servers = await cache.get('servers', async () => {
            try {
                const result = await exec.execute(['list', 'servers']);
                return OutputParser.parseServers(result.stdout);
            }
            catch {
                return [];
            }
        });
        if (servers.length === 0) {
            return [];
        }
        const result = await checkbox({
            message: `${message} (${servers.length} available)`,
            choices: servers.map(s => ({
                value: s.name,
                name: s.name,
                description: s.description,
            })),
            pageSize: 15,
        });
        return result;
    }
    static async textInput(message, options = {}) {
        return input({
            message,
            default: options.default,
            validate: (value) => {
                if (options.required && !value.trim()) {
                    return 'This field is required';
                }
                if (options.validate) {
                    return options.validate(value);
                }
                return true;
            },
        });
    }
    static async confirm(message, defaultValue = true) {
        return confirm({
            message,
            default: defaultValue,
        });
    }
    static async select(message, choices, options = {}) {
        return customSelect({
            message,
            choices,
            loop: options.loop ?? false,
            pageSize: options.pageSize,
        });
    }
    static async selectGroup(message = 'Select a tool group', registryUrl) {
        const exec = registryUrl ? new MCPJungleExecutor(registryUrl) : executor;
        const groups = await cache.get('groups', async () => {
            try {
                const result = await exec.execute(['list', 'groups']);
                return OutputParser.parseGroups(result.stdout);
            }
            catch {
                return [];
            }
        });
        if (groups.length === 0) {
            throw new Error('No tool groups defined');
        }
        return search({
            message,
            source: async (input) => {
                const filtered = input
                    ? groups.filter(g => g.name.toLowerCase().includes(input.toLowerCase()) ||
                        (g.description && g.description.toLowerCase().includes(input.toLowerCase())))
                    : groups;
                return filtered.map(g => ({
                    value: g.name,
                    name: g.name,
                    description: g.description || 'Tool group',
                }));
            },
        });
    }
    static async selectPrompt(message = 'Select a prompt', serverFilter, registryUrl) {
        const exec = registryUrl ? new MCPJungleExecutor(registryUrl) : executor;
        const cacheKey = serverFilter ? `prompts_${serverFilter}` : 'prompts';
        const prompts = await cache.get(cacheKey, async () => {
            try {
                const args = ['list', 'prompts'];
                if (serverFilter)
                    args.push('--server', serverFilter);
                const result = await exec.execute(args);
                return OutputParser.parsePrompts(result.stdout);
            }
            catch {
                return [];
            }
        });
        if (prompts.length === 0) {
            throw new Error(serverFilter
                ? `No prompts found for server "${serverFilter}"`
                : 'No prompts available');
        }
        return search({
            message,
            source: async (input) => {
                const filtered = input
                    ? prompts.filter(p => p.canonicalName.toLowerCase().includes(input.toLowerCase()) ||
                        (p.description && p.description.toLowerCase().includes(input.toLowerCase())))
                    : prompts;
                return filtered.map(p => ({
                    value: p.canonicalName,
                    name: p.canonicalName,
                    description: p.description || `Prompt from ${p.serverName}`,
                }));
            },
        });
    }
}
//# sourceMappingURL=prompts.js.map