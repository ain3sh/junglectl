import { spawn, spawnSync } from 'child_process';
import { EventEmitter } from 'events';
export class UniversalCLIExecutor extends EventEmitter {
    childProcess = null;
    commandName;
    defaultArgs;
    constructor(commandName, defaultArgs = []) {
        super();
        this.commandName = commandName;
        this.defaultArgs = defaultArgs;
    }
    async execute(args, options = {}) {
        const startTime = Date.now();
        let stdout = '';
        let stderr = '';
        const finalArgs = [...this.defaultArgs, ...args];
        return new Promise((resolve, reject) => {
            let timeoutId = null;
            try {
                this.childProcess = spawn(this.commandName, finalArgs, {
                    cwd: options.cwd || process.cwd(),
                    env: {
                        ...process.env,
                        ...options.env,
                        FORCE_COLOR: '3',
                        COLORTERM: 'truecolor',
                        TERM: 'xterm-256color',
                    },
                    stdio: ['ignore', 'pipe', 'pipe'],
                });
                this.childProcess.stdout?.on('data', (data) => {
                    const encoding = (options.encoding || 'utf8');
                    const text = data.toString(encoding);
                    stdout += text;
                    this.emit('data', text);
                });
                this.childProcess.stderr?.on('data', (data) => {
                    const encoding = (options.encoding || 'utf8');
                    stderr += data.toString(encoding);
                });
                this.childProcess.on('exit', (exitCode, signal) => {
                    const duration = Date.now() - startTime;
                    if (timeoutId) {
                        clearTimeout(timeoutId);
                        timeoutId = null;
                    }
                    this.childProcess = null;
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
                    }
                    else {
                        reject(new Error(`Command failed with exit code ${exitCode}${signal ? ` (signal: ${signal})` : ''}\n${cleanStdout}`));
                    }
                });
                this.childProcess.on('error', (error) => {
                    if (timeoutId) {
                        clearTimeout(timeoutId);
                        timeoutId = null;
                    }
                    this.childProcess = null;
                    reject(error);
                });
                const timeout = options.timeout || 30000;
                timeoutId = setTimeout(() => {
                    if (this.childProcess) {
                        this.childProcess.kill();
                        this.childProcess = null;
                        reject(new Error(`Command timeout exceeded (${timeout}ms)`));
                    }
                }, timeout);
            }
            catch (error) {
                if (timeoutId) {
                    clearTimeout(timeoutId);
                }
                reject(error);
            }
        });
    }
    kill() {
        if (this.childProcess) {
            this.childProcess.kill();
            this.childProcess = null;
        }
    }
    static isAvailable(commandName) {
        try {
            const result = spawnSync('which', [commandName], {
                encoding: 'utf8',
                timeout: 3000,
            });
            return result.status === 0 && result.stdout.trim().length > 0;
        }
        catch {
            return false;
        }
    }
    static async getVersion(commandName) {
        const versionFlags = ['--version', '-v', 'version', '-V'];
        for (const flag of versionFlags) {
            try {
                const executor = new UniversalCLIExecutor(commandName);
                const result = await executor.execute([flag], {
                    timeout: 5000,
                    acceptOutputOnError: true,
                });
                const versionMatch = result.stdout.match(/v?([\d]+\.[\d]+\.[\d]+)/i);
                if (versionMatch?.[1]) {
                    return versionMatch[1];
                }
                const firstLine = result.stdout.split('\n')[0]?.trim();
                if (firstLine && firstLine.length < 100) {
                    return firstLine;
                }
            }
            catch {
                continue;
            }
        }
        return null;
    }
    getCommandName() {
        return this.commandName;
    }
}
export class MCPJungleExecutor extends UniversalCLIExecutor {
    constructor(registryUrl) {
        const defaultArgs = registryUrl && registryUrl !== 'http://127.0.0.1:8080'
            ? ['--registry', registryUrl]
            : [];
        super('mcpjungle', defaultArgs);
    }
}
export async function isMCPJungleAvailable() {
    return Promise.resolve(UniversalCLIExecutor.isAvailable('mcpjungle'));
}
export async function getMCPJungleVersion() {
    return UniversalCLIExecutor.getVersion('mcpjungle');
}
//# sourceMappingURL=executor.js.map