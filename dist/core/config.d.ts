import type { AppConfig } from '../types/config.js';
export declare function getConfigDir(): string;
export declare function getConfigFilePath(): string;
export declare function ensureConfigDir(): Promise<void>;
export declare function loadConfig(): Promise<AppConfig>;
export declare function saveConfig(config: AppConfig): Promise<void>;
export declare function validateConfig(config: Partial<AppConfig>): AppConfig;
export declare function isFirstRun(): Promise<boolean>;
export declare function resetConfig(): Promise<AppConfig>;
//# sourceMappingURL=config.d.ts.map