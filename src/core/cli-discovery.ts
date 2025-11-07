/**
 * CLI Discovery System
 * Dynamically discovers command-line tools available on the system
 * NO HARDCODED LISTS - pure algorithmic discovery from PATH
 *
 * CRITICAL SAFETY NOTES:
 * - Help flags are tested SEQUENTIALLY (not in parallel) to prevent process explosion
 * - maxConcurrent is kept low (default 10) to prevent spawning too many processes
 * - GUI applications are filtered out to prevent opening app windows
 * - These safeguards prevent runaway behavior that could look like malware
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
  onProgress?: (current: number, total: number) => void; // Progress callback
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
 * Check if a candidate is likely noise (algorithmic, no hardcoded lists)
 * Returns true if candidate should be filtered out BEFORE expensive help testing
 */
function isLikelyNoise(name: string, path: string): boolean {
  // Single-character names are usually basic system utilities
  if (name.length === 1) return true;

  // Two-character names are also usually system utilities
  if (name.length === 2) return true;

  // Files with common non-CLI extensions
  if (/\.(so|a|dylib|dll|o|conf|txt|md|json|xml|yml|yaml)$/i.test(name)) {
    return true;
  }

  // Scripts without execute bit or with shebang-only functionality
  // (These were already filtered by executable check, but double-check)
  if (name.endsWith('~') || name.endsWith('.bak') || name.endsWith('.swp')) {
    return true;
  }

  // Version-suffixed duplicates (python3.11, gcc-11, node18, etc.)
  // Keep the base version (python3, gcc) but filter numbered variants
  if (/\d{2,}$/.test(name)) return true; // Ends with 2+ digits
  if (/[.-]\d+\.\d+/.test(name)) return true; // Contains version like -1.2 or .3.4

  // All-caps short names are often system utilities or aliases
  if (name.length <= 4 && name === name.toUpperCase()) {
    return true;
  }

  // Common system utility prefixes (algorithmic patterns, not exhaustive list)
  if (name.startsWith('_')) return true; // Internal/private utilities
  if (name.startsWith('.')) return true; // Hidden utilities (shouldn't get here but check)

  // System library paths are unlikely to contain useful CLIs
  if (path.includes('/System/Library/') || path.includes('/usr/libexec/')) {
    return true;
  }

  // CRITICAL: WSL Windows interop paths - THE ROOT CAUSE OF RUNAWAY BEHAVIOR
  // WSL2 adds Windows executables to PATH via /mnt/c/Program Files/...
  // These GUI apps launch when spawned and ignore --help flags
  // This single filter prevents the catastrophic "opening every app" issue
  if (path.startsWith('/mnt/')) {
    return true;
  }

  // Windows executables - redundant safety for edge cases
  // Catches .exe files that might slip through other filters
  if (name.toLowerCase().endsWith('.exe')) {
    return true;
  }

  // CRITICAL: Filter out GUI applications to prevent runaway behavior
  // macOS app bundles - these will open GUI windows when executed
  if (path.includes('.app/Contents/MacOS/') || path.includes('.app/Contents/Resources/')) {
    return true;
  }

  // Windows GUI executables are typically in specific directories
  // Check both backslashes (native Windows) and forward slashes (WSL)
  if (path.includes('\\Program Files\\') || path.includes('\\Program Files (x86)\\')) {
    return true; // Native Windows paths
  }
  if (path.includes('/Program Files/') || path.includes('/Program Files (x86)/')) {
    return true; // WSL-style Windows paths (redundant with /mnt/ filter above, but explicit)
  }

  // Common GUI app patterns across platforms
  if (name.toLowerCase().includes('helper') || name.toLowerCase().includes('agent')) {
    return true;
  }

  return false;
}

/**
 * Perform actual discovery (separate for caching logic)
 */
async function performDiscovery(options: DiscoveryOptions): Promise<DiscoveredCLI[]> {
  const {
    maxConcurrent = 10, // Conservative default to prevent runaway behavior (reduced from 25)
    timeout = 2000,
    onProgress,
  } = options;

  // Phase 1: Scan PATH directories
  const allCandidates = await scanPathDirectories();

  // Phase 1.5: Early filtering - remove obvious noise BEFORE expensive help testing
  // This dramatically improves performance by reducing test volume
  const candidates = allCandidates.filter(candidate => !isLikelyNoise(candidate.name, candidate.path));

  // Phase 2: Test and score (with concurrency limit)
  const discovered: DiscoveredCLI[] = [];
  let processedCount = 0;

  for (let i = 0; i < candidates.length; i += maxConcurrent) {
    const batch = candidates.slice(i, i + maxConcurrent);
    const results = await Promise.all(
      batch.map(c => testAndScoreCLI(c, timeout))
    );

    discovered.push(...results.filter((r): r is DiscoveredCLI => r !== null));

    // Report progress after each batch
    processedCount += batch.length;
    if (onProgress) {
      onProgress(processedCount, candidates.length);
    }
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
 * IMPORTANT: Tests flags SEQUENTIALLY to prevent spawning too many processes
 * This prevents the runaway behavior where GUI apps open simultaneously
 */
async function testHelpSupport(cliPath: string, timeout: number): Promise<string | null> {
  // Removed 'help' positional argument - it can trigger subcommands/interactive modes
  // Added '-?' which is safer and Windows-compatible
  const helpFlags = ['--help', '-h', '-?'];

  // Test flags one at a time, stop on first success
  // This is CRITICAL to prevent spawning 3x processes for every CLI
  // Sequential testing: if --help works, we never test -h or -?
  for (const flag of helpFlags) {
    try {
      const output = await executeWithTimeout(cliPath, [flag], timeout);
      if (output && output.length > 10) {
        return output; // Stop on first success
      }
    } catch {
      // Try next flag
      continue;
    }
  }

  return null;
}

/**
 * Execute command with timeout
 * Implements proper timeout with SIGKILL fallback for stubborn processes
 */
function executeWithTimeout(command: string, args: string[], timeout: number): Promise<string | null> {
  return new Promise((resolve) => {
    // Note: spawn's timeout option is unreliable, so we implement our own
    const child = spawn(command, args, {
      stdio: ['ignore', 'pipe', 'pipe'],
      env: buildSandboxEnv(),       // CRITICAL: Sandbox environment prevents GUI launches
      windowsHide: true,            // Windows-specific GUI suppression
    });

    let stdout = '';
    let timedOut = false;
    let killed = false;

    // SIGTERM timeout - graceful shutdown attempt
    const SIGTERM_GRACE_PERIOD = 100; // ms to wait before SIGKILL

    const sigtermTimer = setTimeout(() => {
      if (!killed) {
        timedOut = true;
        killed = true;
        child.kill('SIGTERM'); // Try graceful shutdown first

        // SIGKILL fallback - force kill stubborn processes
        const sigkillTimer = setTimeout(() => {
          if (child.exitCode === null) {
            child.kill('SIGKILL'); // Force kill if process didn't respond to SIGTERM
          }
        }, SIGTERM_GRACE_PERIOD);

        // Clean up SIGKILL timer if process exits
        child.once('exit', () => clearTimeout(sigkillTimer));
      }
      resolve(null);
    }, timeout);

    child.stdout?.on('data', (data) => {
      // Limit stdout collection to prevent memory issues
      const MAX_STDOUT_SIZE = 100000; // 100KB should be enough for help text
      if (stdout.length < MAX_STDOUT_SIZE) {
        stdout += data.toString();
      }
    });

    // CRITICAL: Drain stderr to prevent backpressure hangs
    // If stderr buffer fills up and we don't read it, the process will block
    // This was causing processes to hang indefinitely on WSL
    child.stderr?.on('data', () => {
      // Intentionally empty - just drain to prevent process from blocking
    });

    child.on('close', () => {
      clearTimeout(sigtermTimer);
      if (!timedOut && stdout.trim()) {
        resolve(stdout);
      } else {
        resolve(null);
      }
    });

    child.on('error', () => {
      clearTimeout(sigtermTimer);
      resolve(null);
    });
  });
}

/**
 * Build execution environment that prevents interactive pagers and GUI launches
 * CRITICAL: This is a key defense against GUI apps launching on WSL/Linux/macOS
 */
function buildSandboxEnv(): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {
    ...process.env,

    // Prevent interactive pagers (blocks waiting for user input)
    PAGER: 'cat',
    MANPAGER: 'cat',
    GIT_PAGER: 'cat',
    AWS_PAGER: '',
    SYSTEMD_PAGER: 'cat',
    LESS: 'FRX', // F=quit if one screen, R=raw control chars, X=no init

    // Prevent GUI launches (CRITICAL for WSL with WSLg)
    DISPLAY: '',                    // X11 - blocks GUI on Linux/WSL
    WAYLAND_DISPLAY: '',            // Wayland - blocks GUI on modern Linux
    DBUS_SESSION_BUS_ADDRESS: '',   // D-Bus - used for app launching
    XDG_RUNTIME_DIR: '',            // XDG runtime - used by desktop apps
    XDG_CURRENT_DESKTOP: '',        // Desktop environment detection
    NO_AT_BRIDGE: '1',              // Accessibility bridge - can trigger GUI
    QT_QPA_PLATFORM: 'offscreen',   // Qt apps run headless
    SDL_AUDIODRIVER: 'dummy',       // SDL apps use dummy audio

    // Force non-interactive, deterministic output
    TERM: 'dumb',                   // Simplest terminal type
    COLUMNS: '80',                  // Fixed width output
    LINES: '24',                    // Fixed height output
    NO_COLOR: '1',                  // Disable ANSI colors
    CLIMB_DISCOVERY: '1',           // Marker for debugging

    // Neutralize editor/browser launches
    VISUAL: 'true',                 // Editor that does nothing (Unix 'true' command)
    EDITOR: 'true',                 // Editor that does nothing
    BROWSER: process.platform === 'win32'
      ? 'C:\\Windows\\System32\\where.exe'  // Windows stub that exists but is safe
      : 'true',                              // Unix stub
    GIT_EDITOR: 'true',             // Git-specific editor override
    SUDO_ASKPASS: '/bin/false',     // Never prompt for sudo password

    // Additional CLI tool-specific flags
    ANSIBLE_NOCOLOR: '1',           // Ansible: disable colors
    CI: '1',                        // Many CLIs detect CI and disable interactive features
  };

  return env;
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

/**
 * Add a single CLI to cache (async, non-blocking)
 * Used when user directly launches a CLI (e.g., `climb npm`)
 * Tests help support and adds to cache in background
 */
export async function addSingleCLIToCache(cliName: string): Promise<void> {
  try {
    // Find CLI path using which
    const cliPath = await findCLIPath(cliName);
    if (!cliPath) return; // Not found

    // Test help support (quick, 1.5s timeout)
    const helpResult = await testHelpSupport(cliPath, 1500);

    // Score and categorize
    const score = scoreByName(cliName) + scoreByCategory(detectCategory(cliPath));
    const helpQuality = helpResult
      ? (helpResult.length > 500 ? 'rich' : 'basic')
      : 'none';

    const discoveredCLI: DiscoveredCLI = {
      name: cliName,
      path: cliPath,
      score: score + (helpResult ? 10 : 0),
      hasHelp: !!helpResult,
      helpQuality: helpQuality as 'rich' | 'basic' | 'none',
      category: detectCategory(cliPath),
    };

    // Load existing cache
    const cached = await loadCache();
    const clis = cached?.clis || [];

    // Check if already exists
    const existingIndex = clis.findIndex(c => c.name === cliName);
    if (existingIndex >= 0) {
      // Update existing entry
      clis[existingIndex] = discoveredCLI;
    } else {
      // Add new entry
      clis.push(discoveredCLI);
      // Re-sort by score
      clis.sort((a, b) => b.score - a.score);
    }

    // Save cache
    await saveCache(clis);
  } catch {
    // Cache update failed - not critical, silently ignore
  }
}

/**
 * Find full path to CLI using which/where command
 */
async function findCLIPath(cliName: string): Promise<string | null> {
  return new Promise((resolve) => {
    const command = os.platform() === 'win32' ? 'where' : 'which';
    const child = spawn(command, [cliName], {
      stdio: ['ignore', 'pipe', 'ignore'],
    });

    let stdout = '';
    child.stdout?.on('data', (data) => {
      stdout += data.toString();
    });

    child.on('close', (code) => {
      if (code === 0 && stdout.trim()) {
        // Return first line (in case multiple paths)
        const firstPath = stdout.trim().split('\n')[0];
        resolve(firstPath || null);
      } else {
        resolve(null);
      }
    });

    child.on('error', () => resolve(null));
  });
}
