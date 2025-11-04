import { EventEmitter } from 'events';
export interface ExecutorOptions {
    timeout?: number;
    encoding?: string;
    env?: Record<string, string>;
    cwd?: string;
    registryUrl?: string;
}
export interface ExecutorResult {
    stdout: string;
    stderr: string;
    exitCode: number;
    duration: number;
}
export declare class MCPJungleExecutor extends EventEmitter {
    private ptyProcess;
    private defaultRegistryUrl;
    constructor(registryUrl?: string);
    execute(args: string[], options?: ExecutorOptions): Promise<ExecutorResult>;
    kill(): void;
    static isAvailable(): Promise<boolean>;
    static getVersion(): Promise<string | null>;
}
//# sourceMappingURL=executor.d.ts.map