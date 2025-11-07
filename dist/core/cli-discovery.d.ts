export interface DiscoveredCLI {
    name: string;
    path: string;
    score: number;
    hasHelp: boolean;
    helpQuality: 'rich' | 'basic' | 'none';
    category: 'user-installed' | 'language-tool' | 'system' | 'unknown';
}
export interface DiscoveryOptions {
    maxConcurrent?: number;
    timeout?: number;
    minScore?: number;
    limit?: number;
    useCache?: boolean;
    cacheTTL?: number;
    onProgress?: (current: number, total: number) => void;
}
export declare function discoverCLIs(options?: DiscoveryOptions): Promise<DiscoveredCLI[]>;
export declare function addSingleCLIToCache(cliName: string): Promise<void>;
//# sourceMappingURL=cli-discovery.d.ts.map