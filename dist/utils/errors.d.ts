export declare class JungleCTLError extends Error {
    readonly cause?: Error;
    readonly hint?: string;
    constructor(message: string, cause?: Error, hint?: string);
}
export declare class ServerConnectionError extends JungleCTLError {
    constructor(url: string, cause?: Error);
}
export declare class ResourceNotFoundError extends JungleCTLError {
    constructor(resourceType: string, resourceName: string);
}
export declare class SchemaParsingError extends JungleCTLError {
    constructor(toolName: string, cause?: Error);
}
export declare class ToolInvocationError extends JungleCTLError {
    constructor(toolName: string, message: string, cause?: Error);
}
export declare class ValidationError extends JungleCTLError {
    constructor(fieldName: string, message: string);
}
export declare class TimeoutError extends JungleCTLError {
    constructor(operation: string, timeoutMs: number);
}
export declare class ConfigError extends JungleCTLError {
    constructor(message: string, cause?: Error);
}
export declare class PermissionError extends JungleCTLError {
    constructor(path: string, operation: string);
}
export declare class UserCancelledError extends Error {
    constructor();
}
export declare function formatError(error: unknown): string;
export declare function parseCliError(output: string): JungleCTLError;
export declare function handleCommandError(error: unknown, context?: string): Promise<void>;
export declare function withErrorHandling<T>(operation: () => Promise<T>, context?: string): Promise<T | null>;
//# sourceMappingURL=errors.d.ts.map