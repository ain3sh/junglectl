export const DEFAULT_CONFIG = {
    version: '2.0.0',
    targetCLI: 'git',
    defaultArgs: [],
    cacheTTL: {
        structure: 5 * 60 * 1000,
        output: 60 * 1000,
    },
    theme: {
        primaryColor: 'cyan',
        enableColors: true,
    },
    timeout: {
        default: 30000,
        introspection: 10000,
        execute: 60000,
    },
    execution: {
        captureHistory: true,
        maxHistorySize: 100,
        showConfidence: true,
    },
};
//# sourceMappingURL=config.js.map