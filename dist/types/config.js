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
export function migrateLegacyConfig(legacy) {
    return {
        version: '2.0.0',
        targetCLI: 'mcpjungle',
        defaultArgs: legacy.registryUrl && legacy.registryUrl !== 'http://127.0.0.1:8080'
            ? ['--registry', legacy.registryUrl]
            : [],
        cacheTTL: {
            structure: Math.max(legacy.cacheTTL.servers, legacy.cacheTTL.tools, legacy.cacheTTL.groups, legacy.cacheTTL.prompts),
            output: legacy.cacheTTL.tools,
        },
        theme: legacy.theme,
        timeout: {
            default: legacy.timeout.default,
            introspection: 10000,
            execute: legacy.timeout.invoke,
        },
        execution: {
            captureHistory: true,
            maxHistorySize: 100,
            showConfidence: true,
        },
        registryUrl: legacy.registryUrl,
    };
}
export function isLegacyConfig(config) {
    return config.registryUrl !== undefined && config.targetCLI === undefined;
}
//# sourceMappingURL=config.js.map