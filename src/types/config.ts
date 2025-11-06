/**
 * Climb Configuration Types
 * Universal CLI TUI configuration
 */

export interface AppConfig {
  version: string;
  targetCLI: string;              // Name of CLI to explore (e.g., 'git', 'docker', 'npm')
  cliPath?: string;               // Optional: custom path to CLI binary
  defaultArgs: string[];          // Args to prepend to every execution (e.g., ['--no-pager'] for git)
  cacheTTL: {
    structure: number;            // Command structure cache (introspection results)
    output: number;               // Command output cache
  };
  theme: {
    primaryColor: 'blue' | 'green' | 'cyan' | 'magenta' | 'yellow';
    enableColors: boolean;
  };
  timeout: {
    default: number;              // Default command timeout
    introspection: number;        // Help introspection timeout
    execute: number;              // Command execution timeout
  };
  execution: {
    captureHistory: boolean;      // Save command history
    maxHistorySize: number;       // Limit history entries
    showConfidence: boolean;      // Show parser confidence scores in UI
  };
  
  // Legacy fields for migration (will be removed in v3.0)
  registryUrl?: string;           // Old mcpjungle-specific field
}

export const DEFAULT_CONFIG: AppConfig = {
  version: '2.0.0',
  targetCLI: 'git',               // Default to git (popular, complex, good demo)
  defaultArgs: [],
  cacheTTL: {
    structure: 5 * 60 * 1000,     // 5 minutes
    output: 60 * 1000,            // 1 minute
  },
  theme: {
    primaryColor: 'cyan',
    enableColors: true,
  },
  timeout: {
    default: 30000,               // 30 seconds
    introspection: 10000,         // 10 seconds for help introspection
    execute: 60000,               // 60 seconds for command execution
  },
  execution: {
    captureHistory: true,
    maxHistorySize: 100,
    showConfidence: true,
  },
};

/**
 * Legacy config interface for backwards compatibility
 */
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

/**
 * Migrate legacy config (v1.0) to new format (v2.0)
 */
export function migrateLegacyConfig(legacy: LegacyAppConfig): AppConfig {
  return {
    version: '2.0.0',
    targetCLI: 'mcpjungle',       // Preserve mcpjungle as target for old users
    defaultArgs: legacy.registryUrl && legacy.registryUrl !== 'http://127.0.0.1:8080'
      ? ['--registry', legacy.registryUrl]
      : [],
    cacheTTL: {
      structure: Math.max(
        legacy.cacheTTL.servers,
        legacy.cacheTTL.tools,
        legacy.cacheTTL.groups,
        legacy.cacheTTL.prompts
      ),
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
    registryUrl: legacy.registryUrl,  // Keep for reference
  };
}

/**
 * Check if config is legacy format
 */
export function isLegacyConfig(config: any): config is LegacyAppConfig {
  return config.registryUrl !== undefined && config.targetCLI === undefined;
}
