import type { TransportType } from '../types/mcpjungle.js';
export declare class Prompts {
    static selectServer(message?: string, registryUrl?: string): Promise<string>;
    static selectTool(message?: string, serverFilter?: string, registryUrl?: string): Promise<string>;
    static selectTransport(): Promise<TransportType>;
    static selectMultipleTools(message?: string, registryUrl?: string): Promise<string[]>;
    static selectMultipleServers(message?: string, registryUrl?: string): Promise<string[]>;
    static textInput(message: string, options?: {
        default?: string;
        required?: boolean;
        validate?: (value: string) => boolean | string;
    }): Promise<string>;
    static confirm(message: string, defaultValue?: boolean): Promise<boolean>;
    static select<T extends string>(message: string, choices: Array<{
        value: T;
        name: string;
        description?: string;
    }>, options?: {
        loop?: boolean;
        pageSize?: number;
    }): Promise<T>;
    static selectGroup(message?: string, registryUrl?: string): Promise<string>;
    static selectPrompt(message?: string, serverFilter?: string, registryUrl?: string): Promise<string>;
}
//# sourceMappingURL=prompts.d.ts.map