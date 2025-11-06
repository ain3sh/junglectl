/**
 * Universal CLI Command Executor
 * Executes any CLI command via child_process (SEA-compatible)
 */

import { spawn, spawnSync, ChildProcess } from 'child_process';
import { EventEmitter } from 'events';

export interface ExecutorOptions {
  timeout?: number;
  encoding?: string;
  env?: Record<string, string>;
  cwd?: string;
  acceptOutputOnError?: boolean;
}

export interface ExecutorResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  duration: number;
}

export class UniversalCLIExecutor extends EventEmitter {
  private childProcess: ChildProcess | null = null;
  private commandName: string;
  private defaultArgs: string[];

  /**
   * Create executor for a specific CLI command
   * @param commandName - Name of the CLI command (e.g., 'git', 'docker', 'npm')
   * @param defaultArgs - Arguments to prepend to every execution (e.g., ['--no-pager'] for git)
   */
  constructor(commandName: string, defaultArgs: string[] = []) {
    super();
    this.commandName = commandName;
    this.defaultArgs = defaultArgs;
  }

  /**
   * Execute a command with the configured CLI
   */
  async execute(
    args: string[],
    options: ExecutorOptions = {}
  ): Promise<ExecutorResult> {
    const startTime = Date.now();
    let stdout = '';
    let stderr = '';

    // Prepend default args (if any)
    const finalArgs = [...this.defaultArgs, ...args];

    return new Promise((resolve, reject) => {
      let timeoutId: NodeJS.Timeout | null = null;
      
      try {
        // Spawn the CLI command via child_process (SEA-compatible)
        this.childProcess = spawn(this.commandName, finalArgs, {
          cwd: options.cwd || process.cwd(),
          env: {
            ...process.env,
            ...options.env,
            FORCE_COLOR: '3',           // Force truecolor output
            COLORTERM: 'truecolor',     // Enable truecolor support
            TERM: 'xterm-256color',     // 256-color terminal
          },
          stdio: ['ignore', 'pipe', 'pipe'], // stdin ignored, stdout/stderr piped
        });

        // Capture stdout
        this.childProcess.stdout?.on('data', (data: Buffer) => {
          const encoding = (options.encoding || 'utf8') as BufferEncoding;
          const text = data.toString(encoding);
          stdout += text;
          this.emit('data', text);
        });

        // Capture stderr
        this.childProcess.stderr?.on('data', (data: Buffer) => {
          const encoding = (options.encoding || 'utf8') as BufferEncoding;
          stderr += data.toString(encoding);
        });

        // Handle exit
        this.childProcess.on('exit', (exitCode, signal) => {
          const duration = Date.now() - startTime;
          
          // Clear timeout on exit
          if (timeoutId) {
            clearTimeout(timeoutId);
            timeoutId = null;
          }
          
          this.childProcess = null;

          // Clean output (keep ANSI codes, just trim whitespace)
          const cleanStdout = stdout.trim();

          const successfulExit = exitCode === 0;
          const allowOutputOnError = options.acceptOutputOnError && cleanStdout.length > 0;

          if (successfulExit || allowOutputOnError) {
            resolve({
              stdout: cleanStdout,
              stderr: stderr.trim(),
              exitCode: exitCode || 0,
              duration,
            });
          } else {
            reject(
              new Error(
                `Command failed with exit code ${exitCode}${signal ? ` (signal: ${signal})` : ''}\n${cleanStdout}`
              )
            );
          }
        });

        // Handle process errors
        this.childProcess.on('error', (error) => {
          if (timeoutId) {
            clearTimeout(timeoutId);
            timeoutId = null;
          }
          this.childProcess = null;
          reject(error);
        });

        // Timeout handling
        const timeout = options.timeout || 30000; // 30s default
        timeoutId = setTimeout(() => {
          if (this.childProcess) {
            this.childProcess.kill();
            this.childProcess = null;
            reject(new Error(`Command timeout exceeded (${timeout}ms)`));
          }
        }, timeout);

      } catch (error) {
        if (timeoutId) {
          clearTimeout(timeoutId);
        }
        reject(error);
      }
    });
  }



  /**
   * Kill the current process
   */
  kill(): void {
    if (this.childProcess) {
      this.childProcess.kill();
      this.childProcess = null;
    }
  }

  /**
   * Check if a CLI command is available in PATH
   */
  static isAvailable(commandName: string): boolean {
    try {
      const result = spawnSync('which', [commandName], {
        encoding: 'utf8',
        timeout: 3000,
      });
      return result.status === 0 && result.stdout.trim().length > 0;
    } catch {
      return false;
    }
  }

  /**
   * Get CLI version (tries common version flags)
   */
  static async getVersion(commandName: string): Promise<string | null> {
    const versionFlags = ['--version', '-v', 'version', '-V'];
    
    for (const flag of versionFlags) {
      try {
        const executor = new UniversalCLIExecutor(commandName);
        const result = await executor.execute([flag], { 
          timeout: 5000,
          acceptOutputOnError: true, // Some CLIs exit with non-zero on --version
        });
        
        // Extract version number from output
        const versionMatch = result.stdout.match(/v?([\d]+\.[\d]+\.[\d]+)/i);
        if (versionMatch?.[1]) {
          return versionMatch[1];
        }
        
        // If no semver found but we got output, return first line
        const firstLine = result.stdout.split('\n')[0]?.trim();
        if (firstLine && firstLine.length < 100) {
          return firstLine;
        }
      } catch {
        continue;
      }
    }
    
    return null;
  }

  /**
   * Get the command name this executor is configured for
   */
  getCommandName(): string {
    return this.commandName;
  }
}

/**
 * Legacy MCPJungleExecutor class for backwards compatibility
 * Wraps UniversalCLIExecutor with mcpjungle-specific defaults
 * 
 * Note: Static methods (isAvailable, getVersion) are inherited from parent.
 * For async versions matching old API, use:
 *   await Promise.resolve(MCPJungleExecutor.isAvailable('mcpjungle'))
 *   await MCPJungleExecutor.getVersion('mcpjungle')
 */
export class MCPJungleExecutor extends UniversalCLIExecutor {
  constructor(registryUrl?: string) {
    // Convert old registryUrl-based constructor to new format
    const defaultArgs = registryUrl && registryUrl !== 'http://127.0.0.1:8080'
      ? ['--registry', registryUrl]
      : [];
    
    super('mcpjungle', defaultArgs);
  }
}

/**
 * Legacy async wrapper functions for backwards compatibility
 * Use these instead of static methods to get Promise-based API
 */
export async function isMCPJungleAvailable(): Promise<boolean> {
  return Promise.resolve(UniversalCLIExecutor.isAvailable('mcpjungle'));
}

export async function getMCPJungleVersion(): Promise<string | null> {
  return UniversalCLIExecutor.getVersion('mcpjungle');
}
