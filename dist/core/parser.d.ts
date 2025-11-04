import type { MCPServer, MCPTool, MCPPrompt, ToolGroup, ToolSchema, ServerStatus } from '../types/mcpjungle.js';
export declare class OutputParser {
    static parseVersion(rawOutput: string): {
        cli?: string;
        server?: string;
        url?: string;
    };
    static parseServerStatus(rawOutput: string, registryUrl: string): ServerStatus;
    static parseServers(rawOutput: string): MCPServer[];
    static parseTools(rawOutput: string): MCPTool[];
    static parseToolSchema(rawOutput: string): ToolSchema | null;
    private static parseSchemaFromText;
    static parsePrompts(rawOutput: string): MCPPrompt[];
    static parseGroups(rawOutput: string): ToolGroup[];
    static isError(rawOutput: string): boolean;
    static extractError(rawOutput: string): string;
    static parseGenericTable(output: string): Record<string, any>[];
    private static looksLikeJson;
    private static parseTableToObjects;
    private static detectColumnBoundaries;
    private static isSeparatorLine;
    private static isBoxLine;
}
//# sourceMappingURL=parser.d.ts.map