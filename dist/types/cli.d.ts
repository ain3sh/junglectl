export interface CommandEntity {
    name: string;
    description: string;
    category?: string;
    hasSubcommands: boolean;
    confidence: number;
    sectionIndex?: number;
}
export interface SubcommandEntity {
    name: string;
    description: string;
    parentPath: string[];
    confidence: number;
}
export interface OptionEntity {
    long?: string;
    short?: string;
    aliases: string[];
    takesValue: boolean;
    argument?: string;
    description: string;
    confidence: number;
}
export interface CommandExecution {
    command: string;
    args: string[];
    timestamp: Date;
    exitCode: number;
    duration: number;
    output: string;
    error?: string;
}
export interface CLICapabilities {
    name: string;
    version?: string;
    commands: CommandEntity[];
    globalOptions: OptionEntity[];
    supportsSubcommands: boolean;
    supportsHelp: boolean;
    helpFlags: string[];
}
export interface ExecutionHistory {
    executions: CommandExecution[];
    maxSize: number;
}
//# sourceMappingURL=cli.d.ts.map