/**
 * CLI Discovery System
 * Dynamically discovers command-line tools available on the system
 * NO HARDCODED LISTS - pure algorithmic discovery from PATH
 */

import fs from 'fs/promises';
import path from 'path';
import { spawn } from 'child_process';
import os from 'os';

export interface DiscoveredCLI {
  name: string;
  path: string;
  score: number;
  hasHelp: boolean;
  helpQuality: 'rich' | 'basic' | 'none';
  category: 'user-installed' | 'language-tool' | 'system' | 'unknown';
}

interface CachedDiscovery {
  timestamp: number;
  pathHash: string;
  clis: DiscoveredCLI[];
}

export interface DiscoveryOptions {
  maxConcurrent?: number;
  timeout?: number;
  minScore?: number;
  limit?: number;
  useCache?: boolean;
  cacheTTL?: number; // milliseconds
}

const CACHE_FILE = path.join(os.homedir(), '.climb', 'cli-discovery-cache.json');
const DEFAULT_CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Main discovery function - scans PATH and scores all executables
 */
export async function discoverCLIs(options: DiscoveryOptions = {}): Promise<DiscoveredCLI[]> {
  const {
    useCache = true,
    cacheTTL = DEFAULT_CACHE_TTL,
  } = options;

  // Try cache first
  if (useCache) {
    const cached = await loadCache();
    if (cached && isCacheValid(cached, cacheTTL)) {
      return filterAndLimitCLIs(cached.clis, options);
    }
  }

  // Perform fresh discovery
  const clis = await performDiscovery(options);

  // Save to cache
  if (useCache) {
    await saveCache(clis).catch(() => {
      // Cache save failed, not critical
    });
  }

  return clis;
}

/**
 * Perform actual discovery (separate for caching logic)
 */
async function performDiscovery(options: DiscoveryOptions): Promise<DiscoveredCLI[]> {
  const {
    maxConcurrent = 10,
    timeout = 2000,
  } = options;

  // Phase 1: Scan PATH directories
  const candidates = await scanPathDirectories();

  // Phase 2: Test and score (with concurrency limit)
  const discovered: DiscoveredCLI[] = [];

  for (let i = 0; i < candidates.length; i += maxConcurrent) {
    const batch = candidates.slice(i, i + maxConcurrent);
    const results = await Promise.all(
      batch.map(c => testAndScoreCLI(c, timeout))
    );

    discovered.push(...results.filter((r): r is DiscoveredCLI => r !== null));
  }

  // Phase 3: Filter and sort
  return filterAndLimitCLIs(discovered, options);
}

/**
 * Filter and limit discovered CLIs
 */
function filterAndLimitCLIs(clis: DiscoveredCLI[], options: DiscoveryOptions): DiscoveredCLI[] {
  const { minScore = 0, limit = 100 } = options;

  return clis
    .filter(cli => cli.score >= minScore)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

/**
 * Scan all PATH directories for executable files
 */
async function scanPathDirectories(): Promise<Array<{ name: string; path: string }>> {
  const pathEnv = process.env.PATH || '';
  const separator = os.platform() === 'win32' ? ';' : ':';
  const directories = pathEnv.split(separator).filter(Boolean);

  const candidates: Array<{ name: string; path: string }> = [];

  for (const dir of directories) {
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });

      for (const entry of entries) {
        // Skip directories and hidden files
        if (!entry.isFile() && !entry.isSymbolicLink()) continue;
        if (entry.name.startsWith('.')) continue;

        const fullPath = path.join(dir, entry.name);

        // Check if executable
        try {
          const stats = await fs.stat(fullPath);
          const isExecutable = (stats.mode & 0o111) !== 0;

          if (isExecutable) {
            candidates.push({ name: entry.name, path: fullPath });
          }
        } catch {
          // Permission denied or broken symlink - skip
          continue;
        }
      }
    } catch {
      // Directory doesn't exist or permission denied - skip
      continue;
    }
  }

  // Deduplicate by name (prefer first in PATH)
  const seen = new Set<string>();
  return candidates.filter(c => {
    if (seen.has(c.name)) return false;
    seen.add(c.name);
    return true;
  });
}

/**
 * Test CLI for help support and calculate score
 */
async function testAndScoreCLI(
  candidate: { name: string; path: string },
  timeout: number
): Promise<DiscoveredCLI | null> {
  let score = 0;
  let hasHelp = false;
  let helpQuality: 'rich' | 'basic' | 'none' = 'none';

  // Test for help support
  const helpResult = await testHelpSupport(candidate.path, timeout);

  if (helpResult) {
    hasHelp = true;
    score += 10;

    // Analyze help text quality
    const helpLength = helpResult.length;
    const hasStructure = /(?:SYNOPSIS|USAGE|DESCRIPTION|OPTIONS|COMMANDS|EXAMPLES)/i.test(helpResult);
    const hasOptions = /--?\w+/.test(helpResult);

    if (helpLength > 500 && hasStructure) {
      helpQuality = 'rich';
      score += 8;
    } else if (helpLength > 100 || hasOptions) {
      helpQuality = 'basic';
      score += 4;
    }
  }

  // Score by name characteristics (algorithmic, no hardcoding specific names)
  score += scoreByName(candidate.name);

  // Score by location (algorithmic category detection)
  const category = detectCategory(candidate.path);
  score += scoreByCategory(category);

  // Filter out very low scores (likely noise)
  if (score < -5) return null;

  return {
    name: candidate.name,
    path: candidate.path,
    score,
    hasHelp,
    helpQuality,
    category,
  };
}

/**
 * Test if CLI supports help flags
 */
async function testHelpSupport(cliPath: string, timeout: number): Promise<string | null> {
  const helpFlags = ['--help', '-h', 'help'];

  for (const flag of helpFlags) {
    try {
      const output = await executeWithTimeout(cliPath, [flag], timeout);
      if (output && output.length > 10) {
        return output;
      }
    } catch {
      // This flag didn't work, try next
      continue;
    }
  }

  return null;
}

/**
 * Execute command with timeout
 */
function executeWithTimeout(command: string, args: string[], timeout: number): Promise<string | null> {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout,
    });

    let stdout = '';
    let timedOut = false;

    const timer = setTimeout(() => {
      timedOut = true;
      child.kill();
      resolve(null);
    }, timeout);

    child.stdout?.on('data', (data) => {
      stdout += data.toString();
    });

    child.on('close', () => {
      clearTimeout(timer);
      if (!timedOut && stdout.trim()) {
        resolve(stdout);
      } else {
        resolve(null);
      }
    });

    child.on('error', () => {
      clearTimeout(timer);
      resolve(null);
    });
  });
}

/**
 * Score based on name patterns (algorithmic)
 */
function scoreByName(name: string): number {
  let score = 0;

  // Length heuristics
  if (name.length < 2) score -= 5;  // Single char commands often system utils
  if (name.length >= 3 && name.length <= 15) score += 2;  // Sweet spot for tool names

  // Version suffix detection (algorithmic)
  if (/\d+(\.\d+)*$/.test(name)) {
    score -= 3;  // python3.11, gcc-11, etc. are duplicate versions
  }

  // Hyphenated compound names often good tools
  if (/^[a-z]+-[a-z]+/.test(name)) {
    score += 2;  // docker-compose, npm-check, etc.
  }

  // All caps names often system utilities
  if (name === name.toUpperCase()) {
    score -= 2;
  }

  return score;
}

/**
 * Detect category from path (algorithmic)
 */
function detectCategory(cliPath: string): 'user-installed' | 'language-tool' | 'system' | 'unknown' {
  const normalized = cliPath.toLowerCase();

  // User-installed indicators
  if (normalized.includes('local/bin') || normalized.includes('.local/bin')) {
    return 'user-installed';
  }

  // Language-specific tool directories
  if (
    normalized.includes('cargo/bin') ||
    normalized.includes('node_modules/.bin') ||
    normalized.includes('.npm/') ||
    normalized.includes('go/bin') ||
    normalized.includes('gems/bin') ||
    normalized.includes('python') && normalized.includes('site-packages')
  ) {
    return 'language-tool';
  }

  // System directories
  if (normalized.includes('/usr/bin') || normalized.includes('/bin')) {
    return 'system';
  }

  return 'unknown';
}

/**
 * Score by category
 */
function scoreByCategory(category: 'user-installed' | 'language-tool' | 'system' | 'unknown'): number {
  switch (category) {
    case 'user-installed':
      return 5;  // Highest - user explicitly installed these
    case 'language-tool':
      return 3;  // Good - development tools
    case 'unknown':
      return 1;  // Neutral - might be in ~/bin or other custom location
    case 'system':
      return -2; // Lower - lots of noise here, but some good tools too
  }
}

/**
 * Load cached discovery results
 */
async function loadCache(): Promise<CachedDiscovery | null> {
  try {
    const data = await fs.readFile(CACHE_FILE, 'utf-8');
    return JSON.parse(data);
  } catch {
    return null;
  }
}

/**
 * Save discovery results to cache
 */
async function saveCache(clis: DiscoveredCLI[]): Promise<void> {
  const cacheData: CachedDiscovery = {
    timestamp: Date.now(),
    pathHash: hashString(process.env.PATH || ''),
    clis,
  };

  const cacheDir = path.dirname(CACHE_FILE);
  await fs.mkdir(cacheDir, { recursive: true });
  await fs.writeFile(CACHE_FILE, JSON.stringify(cacheData, null, 2));
}

/**
 * Check if cache is still valid
 */
function isCacheValid(cached: CachedDiscovery, ttl: number): boolean {
  const age = Date.now() - cached.timestamp;
  if (age > ttl) return false;

  // Invalidate if PATH changed
  const currentPathHash = hashString(process.env.PATH || '');
  if (cached.pathHash !== currentPathHash) return false;

  return true;
}

/**
 * Simple string hash function
 */
function hashString(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return hash.toString(36);
}
