import type { AppConfig } from '../types/config.js';
import type { CommandExecution } from '../types/cli.js';
export declare function loadHistory(): Promise<CommandExecution[]>;
export declare function saveHistory(history: CommandExecution[]): Promise<void>;
export declare function addToHistory(execution: CommandExecution, maxSize?: number): Promise<void>;
export declare function historyBrowserInteractive(config: AppConfig): Promise<void>;
//# sourceMappingURL=history.d.ts.map