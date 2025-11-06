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
export interface LegacyAppConfig {
    version: string;
    registryUrl: string;
    cacheTTL: {
        servers: number;
        tools: number;
        groups: number;
        prompts: number;
    };
    theme: {
        primaryColor: 'blue' | 'green' | 'cyan' | 'magenta' | 'yellow';
        enableColors: boolean;
    };
    timeout: {
        default: number;
        invoke: number;
    };
    experimental?: {
        enableSseSupport: boolean;
    };
}
export declare function migrateLegacyConfig(legacy: LegacyAppConfig): AppConfig;
export declare function isLegacyConfig(config: any): config is LegacyAppConfig;
//# sourceMappingURL=config.d.ts.map