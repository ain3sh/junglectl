import { MCPJungleExecutor } from './executor.js';
export class CLIIntrospector {
    cache = null;
    CACHE_TTL = 5 * 60 * 1000;
    executor;
    constructor(registryUrl) {
        this.executor = new MCPJungleExecutor(registryUrl);
    }
    async getCommandStructure() {
        if (this.cache && Date.now() - this.cache.timestamp < this.CACHE_TTL) {
            return this.cache;
        }
        const commands = await this.discoverCommands();
        const subcommands = new Map();
        for (const cmd of commands) {
            if (this.likelyHasSubcommands(cmd.name)) {
                try {
                    const subs = await this.discoverSubcommands(cmd.name);
                    if (subs.length > 0) {
                        subcommands.set(cmd.name, subs);
                        cmd.hasSubcommands = true;
                    }
                }
                catch {
                }
            }
        }
        this.cache = {
            commands,
            subcommands,
            timestamp: Date.now(),
        };
        return this.cache;
    }
    async discoverCommands() {
        try {
            const result = await this.executor.execute(['--help'], { timeout: 5000 });
            return this.parseHelpOutput(result.stdout);
        }
        catch (error) {
            return [];
        }
    }
    async discoverSubcommands(command) {
        try {
            const result = await this.executor.execute([command, '--help'], { timeout: 5000 });
            return this.parseSubcommandOutput(result.stdout);
        }
        catch {
            return [];
        }
    }
    parseHelpOutput(output) {
        const commands = [];
        const basicMatch = output.match(/Basic Commands:(.*?)(?=Advanced Commands:|Flags:|$)/s);
        if (basicMatch && basicMatch[1]) {
            const basicCommands = this.extractCommandsList(basicMatch[1], 'basic');
            commands.push(...basicCommands);
        }
        const advancedMatch = output.match(/Advanced Commands:(.*?)(?=Flags:|$)/s);
        if (advancedMatch && advancedMatch[1]) {
            const advancedCommands = this.extractCommandsList(advancedMatch[1], 'advanced');
            commands.push(...advancedCommands);
        }
        return commands;
    }
    parseSubcommandOutput(output) {
        const subcommands = [];
        const match = output.match(/Available Commands:(.*?)(?=Flags:|$)/s);
        if (!match || !match[1])
            return [];
        const lines = match[1].trim().split('\n');
        for (const line of lines) {
            const cmdMatch = line.match(/^\s+(\S+)\s{2,}(.+)$/);
            if (cmdMatch && cmdMatch[1] && cmdMatch[2]) {
                subcommands.push({
                    name: cmdMatch[1],
                    description: cmdMatch[2].trim(),
                });
            }
        }
        return subcommands;
    }
    extractCommandsList(text, category) {
        const lines = text.trim().split('\n');
        const commands = [];
        for (const line of lines) {
            const match = line.match(/^\s+(\S+)\s{2,}(.+)$/);
            if (match && match[1] && match[2]) {
                commands.push({
                    name: match[1],
                    description: match[2].trim(),
                    category,
                });
            }
        }
        return commands;
    }
    likelyHasSubcommands(name) {
        const knownParents = ['list', 'get', 'create', 'delete', 'disable', 'enable', 'update'];
        return knownParents.includes(name);
    }
    clearCache() {
        this.cache = null;
    }
}
//# sourceMappingURL=introspection.js.map