/**
 * MCPJungle Output Parser
 * Parses mcpjungle CLI output into structured data
 */

import stripAnsi from 'strip-ansi';
import type {
  MCPServer,
  MCPTool,
  MCPPrompt,
  ToolGroup,
  ToolSchema,
  ServerStatus,
} from '../types/mcpjungle.js';

export class OutputParser {
  /**
   * Parse version output
   */
  static parseVersion(rawOutput: string): { cli?: string; server?: string; url?: string } {
    const clean = stripAnsi(rawOutput);
    const result: { cli?: string; server?: string; url?: string } = {};

    const cliMatch = clean.match(/CLI Version:\s+v?([\d.]+)/i);
    if (cliMatch) result.cli = cliMatch[1];

    const serverMatch = clean.match(/Server Version:\s+v?([\d.]+)/i);
    if (serverMatch) result.server = serverMatch[1];

    const urlMatch = clean.match(/Server URL:\s+(https?:\/\/[^\s]+)/i);
    if (urlMatch) result.url = urlMatch[1];

    return result;
  }

  /**
   * Parse server status
   */
  static parseServerStatus(rawOutput: string, registryUrl: string): ServerStatus {
    const versionInfo = this.parseVersion(rawOutput);
    
    return {
      connected: !!versionInfo.server,
      url: versionInfo.url || registryUrl,
      version: versionInfo.server,
    };
  }

  /**
   * Parse `mcpjungle list servers` output
   * Format can be table or simple list
   */
  static parseServers(rawOutput: string): MCPServer[] {
    const clean = stripAnsi(rawOutput).trim();
    
    if (!clean || clean.includes('no servers') || clean.includes('connection refused')) {
      return [];
    }

    const servers: MCPServer[] = [];

    // Try to parse as table format first
    const lines = clean.split('\n').filter(l => l.trim() && !l.includes('───') && !l.includes('---'));
    
    // Skip header line if present
    let startIndex = 0;
    if (lines[0]?.toLowerCase().includes('name') || lines[0]?.includes('│')) {
      startIndex = 1;
    }

    for (let i = startIndex; i < lines.length; i++) {
      const line = lines[i]?.trim();
      if (!line) continue;

      // Parse table format: | name | transport | url | enabled |
      if (line.includes('│') || line.includes('|')) {
        const parts = line.split(/[│|]/).map(p => p.trim()).filter(Boolean);
        if (parts.length >= 2) {
          servers.push({
            name: parts[0] || '',
            transport: (parts[1] as any) || 'streamable_http',
            url: parts[2],
            enabled: parts[3]?.toLowerCase() !== 'disabled',
          });
        }
      } else {
        // Parse simple list format: "server-name (transport)"
        const match = line.match(/^([^\s(]+)(?:\s+\(([^)]+)\))?/);
        if (match) {
          servers.push({
            name: match[1] || '',
            transport: (match[2] as any) || 'streamable_http',
            enabled: true,
          });
        }
      }
    }

    return servers;
  }

  /**
   * Parse `mcpjungle list tools` output
   */
  static parseTools(rawOutput: string): MCPTool[] {
    const clean = stripAnsi(rawOutput).trim();
    
    if (!clean || clean.includes('no tools') || clean.includes('connection refused')) {
      return [];
    }

    const tools: MCPTool[] = [];
    const lines = clean.split('\n').filter(l => l.trim() && !l.includes('───') && !l.includes('---'));

    // Skip header
    let startIndex = 0;
    if (lines[0]?.toLowerCase().includes('tool') || lines[0]?.includes('│')) {
      startIndex = 1;
    }

    for (let i = startIndex; i < lines.length; i++) {
      const line = lines[i]?.trim();
      if (!line) continue;

      // Parse canonical name format: server__tool
      let canonicalName = '';
      let description = '';

      if (line.includes('│') || line.includes('|')) {
        const parts = line.split(/[│|]/).map(p => p.trim()).filter(Boolean);
        canonicalName = parts[0] || '';
        description = parts[1] || '';
      } else {
        // Simple format
        const match = line.match(/^([^\s]+)(?:\s+(.+))?/);
        if (match) {
          canonicalName = match[1] || '';
          description = match[2] || '';
        }
      }

      if (canonicalName && canonicalName.includes('__')) {
        const [serverName, toolName] = canonicalName.split('__');
        tools.push({
          name: toolName || '',
          serverName: serverName || '',
          canonicalName,
          description,
          enabled: true,
        });
      }
    }

    return tools;
  }

  /**
   * Parse `mcpjungle usage <tool>` to extract tool schema
   * 
   * MCPJungle outputs individual parameter JSON fragments, not a complete schema.
   * We need to reconstruct the full JSON Schema object.
   * 
   * Format:
   * ```
   * tool__name
   * Description
   * 
   * Input Parameters:
   * =============================
   * paramName (required|optional)
   * {
   *   "type": "string",
   *   "description": "..."
   * }
   * =============================
   * ```
   */
  static parseToolSchema(rawOutput: string): ToolSchema | null {
    const clean = stripAnsi(rawOutput).trim();

    // Check if tool has no parameters
    if (clean.includes('does not require any input parameters')) {
      return {
        type: 'object',
        properties: {},
        required: [],
      };
    }

    // Check if Input Parameters section exists
    if (!clean.includes('Input Parameters:')) {
      return null;
    }

    const schema: ToolSchema = {
      type: 'object',
      properties: {},
      required: [],
    };

    try {
      // Extract parameters section
      const paramsSection = clean.split('Input Parameters:')[1];
      if (!paramsSection) return null;

      // Split by separator lines (=== or ---)
      const paramBlocks = paramsSection.split(/={3,}|−{3,}/);

      for (const block of paramBlocks) {
        const trimmed = block.trim();
        if (!trimmed || trimmed.length < 5) continue;

        // Extract parameter name and required status
        // Format: "paramName (required)" or "paramName (optional)"
        const nameMatch = trimmed.match(/^([a-zA-Z_][a-zA-Z0-9_]*)\s*\(([^)]+)\)/);
        if (!nameMatch) continue;

        const [, paramName, requiredStatus] = nameMatch;
        if (!paramName) continue;

        // Extract JSON schema fragment
        const jsonMatch = trimmed.match(/\{[\s\S]*?\}/);
        if (!jsonMatch) continue;

        try {
          const propSchema = JSON.parse(jsonMatch[0]);
          schema.properties![paramName] = propSchema;

          // Add to required array if marked as required
          if (requiredStatus?.toLowerCase().includes('required')) {
            schema.required!.push(paramName);
          }
        } catch (jsonError) {
          // Skip invalid JSON fragments
          continue;
        }
      }

      // Return schema only if we found at least one property
      return Object.keys(schema.properties!).length > 0 ? schema : null;

    } catch (error) {
      // Fallback to text parsing
      return this.parseSchemaFromText(clean);
    }
  }

  /**
   * Fallback schema parser from descriptive text
   * Used when JSON parsing fails
   */
  private static parseSchemaFromText(text: string): ToolSchema | null {
    const schema: ToolSchema = {
      type: 'object',
      properties: {},
      required: [],
    };

    // Look for parameter lines: "paramName (required)"
    const paramMatches = text.matchAll(/([a-zA-Z_][a-zA-Z0-9_]*)\s*\((required|optional)\)/gi);
    
    for (const match of paramMatches) {
      const [, name, requiredStatus] = match;
      if (name) {
        // Default to string type if we can't determine
        schema.properties![name] = {
          type: 'string',
          description: `Parameter: ${name}`,
        };

        if (requiredStatus?.toLowerCase() === 'required') {
          schema.required!.push(name);
        }
      }
    }

    return Object.keys(schema.properties!).length > 0 ? schema : null;
  }

  /**
   * Parse `mcpjungle list prompts` output
   */
  static parsePrompts(rawOutput: string): MCPPrompt[] {
    const clean = stripAnsi(rawOutput).trim();
    
    if (!clean || clean.includes('no prompts') || clean.includes('connection refused')) {
      return [];
    }

    const prompts: MCPPrompt[] = [];
    const lines = clean.split('\n').filter(l => l.trim());

    for (const line of lines) {
      if (line.includes('__')) {
        const parts = line.split(/\s+/);
        const canonicalName = parts[0];
        if (canonicalName) {
          const [serverName, promptName] = canonicalName.split('__');
          prompts.push({
            name: promptName || '',
            serverName: serverName || '',
            canonicalName,
            description: parts.slice(1).join(' '),
            enabled: true,
          });
        }
      }
    }

    return prompts;
  }

  /**
   * Parse `mcpjungle list groups` output
   */
  static parseGroups(rawOutput: string): ToolGroup[] {
    const clean = stripAnsi(rawOutput).trim();
    
    if (!clean || clean.includes('no groups') || clean.includes('connection refused')) {
      return [];
    }

    const groups: ToolGroup[] = [];
    const lines = clean.split('\n').filter(l => l.trim());

    for (const line of lines) {
      const parts = line.split(/\s{2,}/); // Split on multiple spaces
      if (parts.length >= 1) {
        groups.push({
          name: parts[0] || '',
          description: parts[1],
          endpoint: parts[2],
        });
      }
    }

    return groups;
  }

  /**
   * Check if output indicates an error
   */
  static isError(rawOutput: string): boolean {
    const clean = stripAnsi(rawOutput).toLowerCase();
    return (
      clean.includes('error') ||
      clean.includes('failed') ||
      clean.includes('connection refused') ||
      clean.includes('not found')
    );
  }

  /**
   * Extract error message from output
   */
  static extractError(rawOutput: string): string {
    const clean = stripAnsi(rawOutput);
    
    // Look for common error patterns
    const errorMatch = clean.match(/(?:error|failed):\s*(.+?)(?:\n|$)/i);
    if (errorMatch) {
      return errorMatch[1]!.trim();
    }

    return clean.trim();
  }

  /**
   * Generic table parser - works with any table format
   * Automatically detects columns and parses to objects
   */
  static parseGenericTable(output: string): Record<string, any>[] {
    const clean = stripAnsi(output).trim();

    if (!clean || clean.includes('no ') || clean.includes('connection refused')) {
      return [];
    }

    // Try JSON first
    if (this.looksLikeJson(clean)) {
      try {
        const parsed = JSON.parse(clean);
        return Array.isArray(parsed) ? parsed : [parsed];
      } catch {
        // Not valid JSON, continue to table parsing
      }
    }

    // Parse as table
    return this.parseTableToObjects(clean);
  }

  /**
   * Check if output looks like JSON
   */
  private static looksLikeJson(text: string): boolean {
    const trimmed = text.trim();
    return (trimmed.startsWith('{') || trimmed.startsWith('[')) &&
           (trimmed.endsWith('}') || trimmed.endsWith(']'));
  }

  /**
   * Parse table structure to array of objects
   */
  private static parseTableToObjects(table: string): Record<string, any>[] {
    const lines = table.split('\n').map(l => l.trim()).filter(Boolean);

    if (lines.length === 0) return [];

    // Find header and separator lines
    let headerLine = '';
    let headerIndex = -1;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (!line) continue;
      
      // Skip box drawing lines
      if (this.isBoxLine(line)) continue;

      // Found header (first non-box line)
      if (!headerLine && !this.isSeparatorLine(line)) {
        headerLine = line;
        headerIndex = i;
        break;
      }
    }

    if (!headerLine) return [];

    // Detect column boundaries
    const columns = this.detectColumnBoundaries(headerLine, lines[headerIndex + 1]);

    // Extract headers
    const headers = columns.map(col => {
      const header = headerLine.substring(col.start, col.end);
      return header ? header.trim().replace(/[│|]/g, '').trim() : '';
    }).filter(Boolean);

    if (headers.length === 0) return [];

    // Parse data rows
    const rows: Record<string, any>[] = [];

    for (let i = headerIndex + 1; i < lines.length; i++) {
      const line = lines[i];
      if (!line) continue;

      // Skip separator and box lines
      if (this.isSeparatorLine(line) || this.isBoxLine(line)) continue;

      // Parse data row
      const row: Record<string, any> = {};
      let hasData = false;

      columns.forEach((col, idx) => {
        if (idx < headers.length && line) {
          const substr = line.substring(col.start, col.end);
          const value = substr ? substr.trim().replace(/[│|]/g, '').trim() : '';
          
          if (value && headers[idx]) {
            row[headers[idx]!] = value;
            hasData = true;
          }
        }
      });

      if (hasData) {
        rows.push(row);
      }
    }

    return rows;
  }

  /**
   * Detect column boundaries from table structure
   */
  private static detectColumnBoundaries(header: string, nextLine?: string): Array<{start: number, end: number}> {
    const columns: Array<{start: number, end: number}> = [];

    // Method 1: Use separator line if available
    if (nextLine && this.isSeparatorLine(nextLine)) {
      let inColumn = false;
      let start = 0;

      for (let i = 0; i < nextLine.length; i++) {
        const char = nextLine[i];

        if ((char === '-' || char === '─') && !inColumn) {
          start = i;
          inColumn = true;
        } else if (char !== '-' && char !== '─' && inColumn) {
          columns.push({ start, end: i });
          inColumn = false;
        }
      }

      if (inColumn) {
        columns.push({ start, end: nextLine.length });
      }

      if (columns.length > 0) return columns;
    }

    // Method 2: Use pipe/box separators
    if (header.includes('│') || header.includes('|')) {
      const parts = header.split(/[│|]/);
      let pos = 0;

      for (const part of parts) {
        if (part.trim()) {
          const start = header.indexOf(part, pos);
          const end = start + part.length;
          columns.push({ start, end });
          pos = end;
        }
      }

      if (columns.length > 0) return columns;
    }

    // Method 3: Detect from whitespace (2+ spaces)
    const parts = header.split(/\s{2,}/);
    let pos = 0;

    for (const part of parts) {
      if (part.trim()) {
        const start = header.indexOf(part, pos);
        const end = start + part.length;
        columns.push({ start, end });
        pos = end;
      }
    }

    return columns;
  }

  /**
   * Check if line is a separator (dashes, etc.)
   */
  private static isSeparatorLine(line: string): boolean {
    const cleaned = line.replace(/[│|┌┐└┘├┤┬┴┼]/g, '').trim();
    return cleaned.length > 0 && /^[-─═]+$/.test(cleaned);
  }

  /**
   * Check if line is box drawing (no data)
   */
  private static isBoxLine(line: string): boolean {
    return /^[┌┐└┘├┤┬┴┼─│═║╔╗╚╝╠╣╦╩╬]+$/.test(line.trim());
  }
}
