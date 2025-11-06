import { EventEmitter } from 'events';
export interface ExecutorOptions {
    timeout?: number;
    encoding?: string;
    env?: Record<string, string>;
    cwd?: string;
    acceptOutputOnError?: boolean;
}
export interface ExecutorResult {
    stdout: string;
    stderr: string;
    exitCode: number;
    duration: number;
}
export declare class UniversalCLIExecutor extends EventEmitter {
    private childProcess;
    private commandName;
    private defaultArgs;
    constructor(commandName: string, defaultArgs?: string[]);
    execute(args: string[], options?: ExecutorOptions): Promise<ExecutorResult>;
    kill(): void;
    static isAvailable(commandName: string): boolean;
    static getVersion(commandName: string): Promise<string | null>;
    getCommandName(): string;
}
export declare class MCPJungleExecutor extends UniversalCLIExecutor {
    constructor(registryUrl?: string);
}
export declare function isMCPJungleAvailable(): Promise<boolean>;
export declare function getMCPJungleVersion(): Promise<string | null>;
//# sourceMappingURL=executor.d.ts.map