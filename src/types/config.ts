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

  // MCPJungle-specific optional field
  registryUrl?: string;           // MCPJungle server URL
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
