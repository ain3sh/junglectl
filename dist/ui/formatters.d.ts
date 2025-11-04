import type { MCPServer, MCPTool, ToolGroup, MCPPrompt } from '../types/mcpjungle.js';
export declare class Formatters {
    static serversTable(servers: MCPServer[]): string;
    static toolsTable(tools: MCPTool[]): string;
    static groupsTable(groups: ToolGroup[]): string;
    static promptsTable(prompts: MCPPrompt[]): string;
    static prettyJson(obj: any): string;
    static header(title: string): string;
    static success(message: string): string;
    static error(message: string): string;
    static warning(message: string): string;
    static info(message: string): string;
    static statusBar(status: {
        connected: boolean;
        url: string;
        serverCount?: number;
        toolCount?: number;
    }): string;
    static truncate(text: string, maxLength: number): string;
    static genericTable(data: Record<string, any>[]): string;
    private static formatHeaderName;
    private static formatStatusValue;
}
//# sourceMappingURL=formatters.d.ts.map