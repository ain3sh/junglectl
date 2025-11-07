import fs from 'fs/promises';
import path from 'path';
import { spawn } from 'child_process';
import os from 'os';
const CACHE_FILE = path.join(os.homedir(), '.climb', 'cli-discovery-cache.json');
const DEFAULT_CACHE_TTL = 24 * 60 * 60 * 1000;
export async function discoverCLIs(options = {}) {
    const { useCache = true, cacheTTL = DEFAULT_CACHE_TTL, } = options;
    if (useCache) {
        const cached = await loadCache();
        if (cached && isCacheValid(cached, cacheTTL)) {
            return filterAndLimitCLIs(cached.clis, options);
        }
    }
    const clis = await performDiscovery(options);
    if (useCache) {
        await saveCache(clis).catch(() => {
        });
    }
    return clis;
}
function isLikelyNoise(name, path) {
    if (name.length === 1)
        return true;
    if (name.length === 2)
        return true;
    if (/\.(so|a|dylib|dll|o|conf|txt|md|json|xml|yml|yaml)$/i.test(name)) {
        return true;
    }
    if (name.endsWith('~') || name.endsWith('.bak') || name.endsWith('.swp')) {
        return true;
    }
    if (/\d{2,}$/.test(name))
        return true;
    if (/[.-]\d+\.\d+/.test(name))
        return true;
    if (name.length <= 4 && name === name.toUpperCase()) {
        return true;
    }
    if (name.startsWith('_'))
        return true;
    if (name.startsWith('.'))
        return true;
    if (path.includes('/System/Library/') || path.includes('/usr/libexec/')) {
        return true;
    }
    if (path.startsWith('/mnt/')) {
        return true;
    }
    if (name.toLowerCase().endsWith('.exe')) {
        return true;
    }
    if (path.includes('.app/Contents/MacOS/') || path.includes('.app/Contents/Resources/')) {
        return true;
    }
    if (path.includes('\\Program Files\\') || path.includes('\\Program Files (x86)\\')) {
        return true;
    }
    if (path.includes('/Program Files/') || path.includes('/Program Files (x86)/')) {
        return true;
    }
    if (name.toLowerCase().includes('helper') || name.toLowerCase().includes('agent')) {
        return true;
    }
    return false;
}
async function performDiscovery(options) {
    const { maxConcurrent = 10, timeout = 2000, onProgress, } = options;
    const allCandidates = await scanPathDirectories();
    const candidates = allCandidates.filter(candidate => !isLikelyNoise(candidate.name, candidate.path));
    const discovered = [];
    let processedCount = 0;
    for (let i = 0; i < candidates.length; i += maxConcurrent) {
        const batch = candidates.slice(i, i + maxConcurrent);
        const results = await Promise.all(batch.map(c => testAndScoreCLI(c, timeout)));
        discovered.push(...results.filter((r) => r !== null));
        processedCount += batch.length;
        if (onProgress) {
            onProgress(processedCount, candidates.length);
        }
    }
    return filterAndLimitCLIs(discovered, options);
}
function filterAndLimitCLIs(clis, options) {
    const { minScore = 0, limit = 100 } = options;
    return clis
        .filter(cli => cli.score >= minScore)
        .sort((a, b) => b.score - a.score)
        .slice(0, limit);
}
async function scanPathDirectories() {
    const pathEnv = process.env.PATH || '';
    const separator = os.platform() === 'win32' ? ';' : ':';
    const directories = pathEnv.split(separator).filter(Boolean);
    const candidates = [];
    for (const dir of directories) {
        try {
            const entries = await fs.readdir(dir, { withFileTypes: true });
            for (const entry of entries) {
                if (!entry.isFile() && !entry.isSymbolicLink())
                    continue;
                if (entry.name.startsWith('.'))
                    continue;
                const fullPath = path.join(dir, entry.name);
                try {
                    const stats = await fs.stat(fullPath);
                    const isExecutable = (stats.mode & 0o111) !== 0;
                    if (isExecutable) {
                        candidates.push({ name: entry.name, path: fullPath });
                    }
                }
                catch {
                    continue;
                }
            }
        }
        catch {
            continue;
        }
    }
    const seen = new Set();
    return candidates.filter(c => {
        if (seen.has(c.name))
            return false;
        seen.add(c.name);
        return true;
    });
}
async function testAndScoreCLI(candidate, timeout) {
    let score = 0;
    let hasHelp = false;
    let helpQuality = 'none';
    const helpResult = await testHelpSupport(candidate.path, timeout);
    if (helpResult) {
        hasHelp = true;
        score += 10;
        const helpLength = helpResult.length;
        const hasStructure = /(?:SYNOPSIS|USAGE|DESCRIPTION|OPTIONS|COMMANDS|EXAMPLES)/i.test(helpResult);
        const hasOptions = /--?\w+/.test(helpResult);
        if (helpLength > 500 && hasStructure) {
            helpQuality = 'rich';
            score += 8;
        }
        else if (helpLength > 100 || hasOptions) {
            helpQuality = 'basic';
            score += 4;
        }
    }
    score += scoreByName(candidate.name);
    const category = detectCategory(candidate.path);
    score += scoreByCategory(category);
    if (score < -5)
        return null;
    return {
        name: candidate.name,
        path: candidate.path,
        score,
        hasHelp,
        helpQuality,
        category,
    };
}
async function testHelpSupport(cliPath, timeout) {
    const helpFlags = ['--help', '-h', '-?'];
    for (const flag of helpFlags) {
        try {
            const output = await executeWithTimeout(cliPath, [flag], timeout);
            if (output && output.length > 10) {
                return output;
            }
        }
        catch {
            continue;
        }
    }
    return null;
}
function executeWithTimeout(command, args, timeout) {
    return new Promise((resolve) => {
        const child = spawn(command, args, {
            stdio: ['ignore', 'pipe', 'pipe'],
            env: buildSandboxEnv(),
            windowsHide: true,
        });
        let stdout = '';
        let timedOut = false;
        let killed = false;
        const SIGTERM_GRACE_PERIOD = 100;
        const sigtermTimer = setTimeout(() => {
            if (!killed) {
                timedOut = true;
                killed = true;
                child.kill('SIGTERM');
                const sigkillTimer = setTimeout(() => {
                    if (child.exitCode === null) {
                        child.kill('SIGKILL');
                    }
                }, SIGTERM_GRACE_PERIOD);
                child.once('exit', () => clearTimeout(sigkillTimer));
            }
            resolve(null);
        }, timeout);
        child.stdout?.on('data', (data) => {
            const MAX_STDOUT_SIZE = 100000;
            if (stdout.length < MAX_STDOUT_SIZE) {
                stdout += data.toString();
            }
        });
        child.stderr?.on('data', () => {
        });
        child.on('close', () => {
            clearTimeout(sigtermTimer);
            if (!timedOut && stdout.trim()) {
                resolve(stdout);
            }
            else {
                resolve(null);
            }
        });
        child.on('error', () => {
            clearTimeout(sigtermTimer);
            resolve(null);
        });
    });
}
function buildSandboxEnv() {
    const env = {
        ...process.env,
        PAGER: 'cat',
        MANPAGER: 'cat',
        GIT_PAGER: 'cat',
        AWS_PAGER: '',
        SYSTEMD_PAGER: 'cat',
        LESS: 'FRX',
        DISPLAY: '',
        WAYLAND_DISPLAY: '',
        DBUS_SESSION_BUS_ADDRESS: '',
        XDG_RUNTIME_DIR: '',
        XDG_CURRENT_DESKTOP: '',
        NO_AT_BRIDGE: '1',
        QT_QPA_PLATFORM: 'offscreen',
        SDL_AUDIODRIVER: 'dummy',
        TERM: 'dumb',
        COLUMNS: '80',
        LINES: '24',
        NO_COLOR: '1',
        CLIMB_DISCOVERY: '1',
        VISUAL: 'true',
        EDITOR: 'true',
        BROWSER: process.platform === 'win32'
            ? 'C:\\Windows\\System32\\where.exe'
            : 'true',
        GIT_EDITOR: 'true',
        SUDO_ASKPASS: '/bin/false',
        ANSIBLE_NOCOLOR: '1',
        CI: '1',
    };
    return env;
}
function scoreByName(name) {
    let score = 0;
    if (name.length < 2)
        score -= 5;
    if (name.length >= 3 && name.length <= 15)
        score += 2;
    if (/\d+(\.\d+)*$/.test(name)) {
        score -= 3;
    }
    if (/^[a-z]+-[a-z]+/.test(name)) {
        score += 2;
    }
    if (name === name.toUpperCase()) {
        score -= 2;
    }
    return score;
}
function detectCategory(cliPath) {
    const normalized = cliPath.toLowerCase();
    if (normalized.includes('local/bin') || normalized.includes('.local/bin')) {
        return 'user-installed';
    }
    if (normalized.includes('cargo/bin') ||
        normalized.includes('node_modules/.bin') ||
        normalized.includes('.npm/') ||
        normalized.includes('go/bin') ||
        normalized.includes('gems/bin') ||
        normalized.includes('python') && normalized.includes('site-packages')) {
        return 'language-tool';
    }
    if (normalized.includes('/usr/bin') || normalized.includes('/bin')) {
        return 'system';
    }
    return 'unknown';
}
function scoreByCategory(category) {
    switch (category) {
        case 'user-installed':
            return 5;
        case 'language-tool':
            return 3;
        case 'unknown':
            return 1;
        case 'system':
            return -2;
    }
}
async function loadCache() {
    try {
        const data = await fs.readFile(CACHE_FILE, 'utf-8');
        return JSON.parse(data);
    }
    catch {
        return null;
    }
}
async function saveCache(clis) {
    const cacheData = {
        timestamp: Date.now(),
        pathHash: hashString(process.env.PATH || ''),
        clis,
    };
    const cacheDir = path.dirname(CACHE_FILE);
    await fs.mkdir(cacheDir, { recursive: true });
    await fs.writeFile(CACHE_FILE, JSON.stringify(cacheData, null, 2));
}
function isCacheValid(cached, ttl) {
    const age = Date.now() - cached.timestamp;
    if (age > ttl)
        return false;
    const currentPathHash = hashString(process.env.PATH || '');
    if (cached.pathHash !== currentPathHash)
        return false;
    return true;
}
function hashString(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
    }
    return hash.toString(36);
}
//# sourceMappingURL=cli-discovery.js.map