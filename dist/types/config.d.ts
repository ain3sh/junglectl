export interface AppConfig {
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
    experimental: {
        enableSseSupport: boolean;
    };
}
export declare const DEFAULT_CONFIG: AppConfig;
//# sourceMappingURL=config.d.ts.map