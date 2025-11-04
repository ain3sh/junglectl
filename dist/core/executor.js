import pty from 'node-pty';
import { EventEmitter } from 'events';
export class MCPJungleExecutor extends EventEmitter {
    ptyProcess = null;
    defaultRegistryUrl = 'http://127.0.0.1:8080';
    constructor(registryUrl) {
        super();
        if (registryUrl) {
            this.defaultRegistryUrl = registryUrl;
        }
    }
    async execute(args, options = {}) {
        const startTime = Date.now();
        let stdout = '';
        let stderr = '';
        const finalArgs = [...args];
        const registryUrl = options.registryUrl || this.defaultRegistryUrl;
        if (!finalArgs.includes('--registry') && registryUrl !== 'http://127.0.0.1:8080') {
            finalArgs.push('--registry', registryUrl);
        }
        return new Promise((resolve, reject) => {
            let timeoutId = null;
            try {
                this.ptyProcess = pty.spawn('mcpjungle', finalArgs, {
                    name: 'xterm-color',
                    cols: 120,
                    rows: 30,
                    cwd: options.cwd || process.cwd(),
                    env: {
                        ...process.env,
                        ...options.env,
                        FORCE_COLOR: '1',
                    },
                    encoding: (options.encoding || 'utf8'),
                });
                this.ptyProcess.onData((data) => {
                    stdout += data;
                    this.emit('data', data);
                });
                this.ptyProcess.onExit(({ exitCode, signal }) => {
                    const duration = Date.now() - startTime;
                    if (timeoutId) {
                        clearTimeout(timeoutId);
                        timeoutId = null;
                    }
                    this.ptyProcess = null;
                    const cleanStdout = stdout.trim();
                    if (exitCode === 0) {
                        resolve({
                            stdout: cleanStdout,
                            stderr,
                            exitCode: exitCode || 0,
                            duration,
                        });
                    }
                    else {
                        reject(new Error(`Command failed with exit code ${exitCode}${signal ? ` (signal: ${signal})` : ''}\n${cleanStdout}`));
                    }
                });
                const timeout = options.timeout || 30000;
                timeoutId = setTimeout(() => {
                    if (this.ptyProcess) {
                        this.ptyProcess.kill();
                        this.ptyProcess = null;
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
        if (this.ptyProcess) {
            this.ptyProcess.kill();
            this.ptyProcess = null;
        }
    }
    static async isAvailable() {
        try {
            const executor = new MCPJungleExecutor();
            await executor.execute(['version'], { timeout: 5000 });
            return true;
        }
        catch {
            return false;
        }
    }
    static async getVersion() {
        try {
            const executor = new MCPJungleExecutor();
            const result = await executor.execute(['version'], { timeout: 5000 });
            const versionMatch = result.stdout.match(/CLI Version:\s+v?([\d.]+)/i);
            return versionMatch ? (versionMatch[1] || null) : null;
        }
        catch {
            return null;
        }
    }
}
//# sourceMappingURL=executor.js.map