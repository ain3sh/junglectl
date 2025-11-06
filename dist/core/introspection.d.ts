import { type ParseTelemetry } from './help-parser.js';
export interface Command {
    name: string;
    description: string;
    category: 'basic' | 'advanced';
    hasSubcommands?: boolean;
    confidence?: number;
    sectionIndex?: number;
}
export interface Subcommand {
    name: string;
    description: string;
    confidence?: number;
    path: string[];
}
export interface Flag {
    name: string;
    shorthand?: string;
    description: string;
    type: 'string' | 'boolean';
    default?: string;
}
export interface IntrospectionTelemetry {
    root?: ParseTelemetry;
    subcommands: Record<string, ParseTelemetry>;
    probes: ProbeEvent[];
}
export interface CommandStructure {
    commands: Command[];
    subcommands: Map<string, Subcommand[]>;
    telemetry: IntrospectionTelemetry;
    timestamp: number;
}
interface ProbeEvent {
    path: string[];
    args: string[];
    exitCode: number;
    duration: number;
    success: boolean;
}
export declare class CLIIntrospector {
    private cache;
    private readonly CACHE_TTL;
    private readonly executor;
    private readonly parser;
    private telemetry;
    constructor(registryUrl?: string);
    getCommandStructure(): Promise<CommandStructure>;
    private discoverStructure;
    private captureHelp;
    private toCommands;
    private discoverSubcommands;
    private toSubcommands;
    clearCache(): void;
    getTelemetry(): IntrospectionTelemetry;
}
export {};
//# sourceMappingURL=introspection.d.ts.map