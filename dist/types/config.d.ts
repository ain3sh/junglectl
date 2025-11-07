export interface AppConfig {
    version: string;
    targetCLI: string;
    cliPath?: string;
    defaultArgs: string[];
    cacheTTL: {
        structure: number;
        output: number;
    };
    theme: {
        primaryColor: 'blue' | 'green' | 'cyan' | 'magenta' | 'yellow';
        enableColors: boolean;
    };
    timeout: {
        default: number;
        introspection: number;
        execute: number;
    };
    execution: {
        captureHistory: boolean;
        maxHistorySize: number;
        showConfidence: boolean;
    };
    registryUrl?: string;
}
export declare const DEFAULT_CONFIG: AppConfig;
//# sourceMappingURL=config.d.ts.map