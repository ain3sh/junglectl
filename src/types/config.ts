/**
 * JungleCTL Configuration Types
 */

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

export const DEFAULT_CONFIG: AppConfig = {
  version: '1.0.0',
  registryUrl: 'http://127.0.0.1:8080',
  cacheTTL: {
    servers: 60000, // 60 seconds
    tools: 30000, // 30 seconds
    groups: 60000,
    prompts: 60000,
  },
  theme: {
    primaryColor: 'cyan',
    enableColors: true,
  },
  timeout: {
    default: 30000, // 30 seconds
    invoke: 60000, // 60 seconds for tool invocations
  },
  experimental: {
    enableSseSupport: false,
  },
};
