export const DEFAULT_CONFIG = {
    version: '1.0.0',
    registryUrl: 'http://127.0.0.1:8080',
    cacheTTL: {
        servers: 60000,
        tools: 30000,
        groups: 60000,
        prompts: 60000,
    },
    theme: {
        primaryColor: 'cyan',
        enableColors: true,
    },
    timeout: {
        default: 30000,
        invoke: 60000,
    },
    experimental: {
        enableSseSupport: false,
    },
};
//# sourceMappingURL=config.js.map