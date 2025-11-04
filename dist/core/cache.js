export class TTLCache {
    cache = new Map();
    async get(key, fetcher, ttl = 30000) {
        const cached = this.cache.get(key);
        if (cached && Date.now() < cached.expiry) {
            return cached.data;
        }
        const data = await fetcher();
        this.cache.set(key, {
            data,
            expiry: Date.now() + ttl,
        });
        return data;
    }
    invalidate(key) {
        if (key) {
            this.cache.delete(key);
        }
        else {
            this.cache.clear();
        }
    }
    has(key) {
        const cached = this.cache.get(key);
        return !!cached && Date.now() < cached.expiry;
    }
    stats() {
        return {
            size: this.cache.size,
            keys: Array.from(this.cache.keys()),
        };
    }
    cleanup() {
        const now = Date.now();
        for (const [key, entry] of this.cache.entries()) {
            if (now >= entry.expiry) {
                this.cache.delete(key);
            }
        }
    }
}
export const cache = new TTLCache();
setInterval(() => {
    cache.cleanup();
}, 5 * 60 * 1000);
//# sourceMappingURL=cache.js.map