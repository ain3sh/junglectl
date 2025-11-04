export interface Command {
    name: string;
    description: string;
    category: 'basic' | 'advanced';
    hasSubcommands?: boolean;
}
export interface Subcommand {
    name: string;
    description: string;
}
export interface Flag {
    name: string;
    shorthand?: string;
    description: string;
    type: 'string' | 'boolean';
    default?: string;
}
export interface CommandStructure {
    commands: Command[];
    subcommands: Map<string, Subcommand[]>;
    timestamp: number;
}
export declare class CLIIntrospector {
    private cache;
    private readonly CACHE_TTL;
    private executor;
    constructor(registryUrl?: string);
    getCommandStructure(): Promise<CommandStructure>;
    private discoverCommands;
    private discoverSubcommands;
    private parseHelpOutput;
    private parseSubcommandOutput;
    private extractCommandsList;
    private likelyHasSubcommands;
    clearCache(): void;
}
//# sourceMappingURL=introspection.d.ts.map