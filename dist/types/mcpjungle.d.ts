export type TransportType = 'stdio' | 'streamable_http' | 'sse';
export interface MCPServer {
    name: string;
    transport: TransportType;
    description?: string;
    url?: string;
    command?: string;
    args?: string[];
    env?: Record<string, string>;
    bearerToken?: string;
    enabled: boolean;
    source?: string;
}
export interface MCPTool {
    name: string;
    serverName: string;
    canonicalName: string;
    description?: string;
    schema?: ToolSchema;
    enabled: boolean;
}
export interface ToolSchema {
    type: string;
    properties?: Record<string, SchemaProperty>;
    required?: string[];
    [key: string]: any;
}
export interface SchemaProperty {
    type: string;
    description?: string;
    enum?: any[];
    default?: any;
    [key: string]: any;
}
export interface MCPPrompt {
    name: string;
    serverName: string;
    canonicalName: string;
    description?: string;
    arguments?: PromptArgument[];
    enabled: boolean;
}
export interface PromptArgument {
    name: string;
    description?: string;
    required?: boolean;
}
export interface ToolGroup {
    name: string;
    description?: string;
    includedTools?: string[];
    includedServers?: string[];
    excludedTools?: string[];
    endpoint?: string;
}
export interface MCPClient {
    name: string;
    allowedServers: string[];
    token?: string;
}
export interface ServerStatus {
    connected: boolean;
    url: string;
    version?: string;
    serverCount?: number;
    toolCount?: number;
    mode?: 'development' | 'enterprise';
}
export interface HttpServerConfig {
    name: string;
    transport: 'streamable_http';
    description?: string;
    url: string;
    bearer_token?: string;
}
export interface StdioServerConfig {
    name: string;
    transport: 'stdio';
    description?: string;
    command: string;
    args: string[];
    env?: Record<string, string>;
}
export interface SseServerConfig {
    name: string;
    transport: 'sse';
    description?: string;
    url: string;
}
export type ServerConfig = HttpServerConfig | StdioServerConfig | SseServerConfig;
export interface ToolGroupConfig {
    name: string;
    description?: string;
    included_tools?: string[];
    included_servers?: string[];
    excluded_tools?: string[];
}
//# sourceMappingURL=mcpjungle.d.ts.map