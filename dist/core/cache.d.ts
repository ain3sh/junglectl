export declare class TTLCache {
    private cache;
    get<T>(key: string, fetcher: () => Promise<T>, ttl?: number): Promise<T>;
    invalidate(key?: string): void;
    has(key: string): boolean;
    stats(): {
        size: number;
        keys: string[];
    };
    cleanup(): void;
}
export declare const cache: TTLCache;
//# sourceMappingURL=cache.d.ts.map