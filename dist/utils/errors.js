import chalk from 'chalk';
import { Formatters } from '../ui/formatters.js';
export class JungleCTLError extends Error {
    cause;
    hint;
    constructor(message, cause, hint) {
        super(message);
        this.name = 'JungleCTLError';
        this.cause = cause;
        this.hint = hint;
    }
}
export class ServerConnectionError extends JungleCTLError {
    constructor(url, cause) {
        const hint = `
Troubleshooting steps:
1. Check if MCPJungle server is running:
   • Run: mcpjungle start
   • Or: docker compose up -d
2. Verify the registry URL in Settings → Edit Registry URL
3. Test connectivity: curl ${url}/health
4. Check firewall settings (port may be blocked)
5. Ensure no other service is using port ${new URL(url).port || '8080'}
    `.trim();
        super(`Cannot connect to MCPJungle server at ${url}`, cause, hint);
        this.name = 'ServerConnectionError';
    }
}
export class ResourceNotFoundError extends JungleCTLError {
    constructor(resourceType, resourceName) {
        const hint = `
Troubleshooting steps:
1. List available ${resourceType.toLowerCase()}s to verify the name
2. Check spelling (use autocomplete to avoid typos)
3. Refresh the list (cache may be stale)
4. If it's a new ${resourceType.toLowerCase()}, it may not be registered yet
    `.trim();
        super(`${resourceType} "${resourceName}" not found`, undefined, hint);
        this.name = 'ResourceNotFoundError';
    }
}
export class SchemaParsingError extends JungleCTLError {
    constructor(toolName, cause) {
        const hint = `
Troubleshooting steps:
1. The tool may not provide a schema - this is OK
2. You can still invoke it using manual JSON input
3. Check tool documentation: mcpjungle usage ${toolName}
4. If the tool recently changed, try clearing cache
    `.trim();
        super(`Failed to parse schema for tool "${toolName}"`, cause, hint);
        this.name = 'SchemaParsingError';
    }
}
export class ToolInvocationError extends JungleCTLError {
    constructor(toolName, message, cause) {
        const hint = `
Troubleshooting steps:
1. Verify input parameters are correct
2. Check tool usage: mcpjungle usage ${toolName}
3. Try with simpler input to test
4. Check if the tool's server is responding
5. Increase timeout in Settings if tool is slow
    `.trim();
        super(`Tool "${toolName}" execution failed: ${message}`, cause, hint);
        this.name = 'ToolInvocationError';
    }
}
export class ValidationError extends JungleCTLError {
    constructor(fieldName, message) {
        super(`Validation failed for "${fieldName}": ${message}`, undefined, undefined);
        this.name = 'ValidationError';
    }
}
export class TimeoutError extends JungleCTLError {
    constructor(operation, timeoutMs) {
        const hint = `
Troubleshooting steps:
1. The operation took longer than ${timeoutMs / 1000} seconds
2. Increase timeout in Settings → Edit Timeouts
3. Check if the server is under heavy load
4. Try the operation again (may be temporary)
5. Check server logs for stuck operations
    `.trim();
        super(`Operation "${operation}" timed out after ${timeoutMs}ms`, undefined, hint);
        this.name = 'TimeoutError';
    }
}
export class ConfigError extends JungleCTLError {
    constructor(message, cause) {
        const hint = `
Troubleshooting steps:
1. Check config file for syntax errors
2. File location: ~/.junglectl/config.json
3. Reset to defaults: Delete the config file and restart
4. Check file permissions (must be readable/writable)
5. Validate JSON syntax with: cat ~/.junglectl/config.json | jq
    `.trim();
        super(message, cause, hint);
        this.name = 'ConfigError';
    }
}
export class PermissionError extends JungleCTLError {
    constructor(path, operation) {
        const hint = `
Troubleshooting steps:
1. Check file permissions: ls -la ${path}
2. Ensure you have ${operation} access
3. Fix permissions: chmod u+rw ${path}
4. Check if file is owned by you: ls -l ${path}
5. Run as appropriate user (avoid sudo if possible)
    `.trim();
        super(`Permission denied: ${operation} ${path}`, undefined, hint);
        this.name = 'PermissionError';
    }
}
export class UserCancelledError extends Error {
    constructor() {
        super('Operation cancelled by user');
        this.name = 'UserCancelledError';
    }
}
export function formatError(error) {
    if (error instanceof UserCancelledError) {
        return chalk.yellow('\n✗ Operation cancelled');
    }
    if (error instanceof JungleCTLError) {
        let output = Formatters.error(error.message);
        if (error.cause) {
            output += '\n' + chalk.gray('Caused by: ' + error.cause.message);
        }
        if (error.hint) {
            output += '\n\n' + chalk.gray('💡 Hint: ' + error.hint);
        }
        return output;
    }
    if (error instanceof Error) {
        return Formatters.error(error.message);
    }
    return Formatters.error(String(error));
}
export function parseCliError(output) {
    const clean = output.toLowerCase();
    if (clean.includes('connection refused')) {
        const urlMatch = output.match(/https?:\/\/[^\s]+/);
        const url = urlMatch ? urlMatch[0] : 'http://127.0.0.1:8080';
        return new ServerConnectionError(url);
    }
    if (clean.includes('not found')) {
        return new JungleCTLError('Resource not found', undefined, 'Check the resource name and try again');
    }
    if (clean.includes('timeout')) {
        return new TimeoutError('MCPJungle command', 60000);
    }
    const errorMatch = output.match(/error:\s*(.+?)(?:\n|$)/i);
    if (errorMatch) {
        return new JungleCTLError(errorMatch[1].trim());
    }
    return new JungleCTLError('Command failed', undefined, output.trim());
}
export async function handleCommandError(error, context) {
    console.error('\n' + formatError(error));
    if (context) {
        console.log(chalk.gray(`\nContext: ${context}`));
    }
    if (error instanceof UserCancelledError) {
        return;
    }
    const { confirm } = await import('@inquirer/prompts');
    const shouldContinue = await confirm({
        message: 'Continue?',
        default: true,
    });
    if (!shouldContinue) {
        process.exit(1);
    }
}
export async function withErrorHandling(operation, context) {
    try {
        return await operation();
    }
    catch (error) {
        await handleCommandError(error, context);
        return null;
    }
}
//# sourceMappingURL=errors.js.map