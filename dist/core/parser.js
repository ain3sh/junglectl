import stripAnsi from 'strip-ansi';
export class OutputParser {
    static parseVersion(rawOutput) {
        const clean = stripAnsi(rawOutput);
        const result = {};
        const cliMatch = clean.match(/CLI Version:\s+v?([\d.]+)/i);
        if (cliMatch)
            result.cli = cliMatch[1];
        const serverMatch = clean.match(/Server Version:\s+v?([\d.]+)/i);
        if (serverMatch)
            result.server = serverMatch[1];
        const urlMatch = clean.match(/Server URL:\s+(https?:\/\/[^\s]+)/i);
        if (urlMatch)
            result.url = urlMatch[1];
        return result;
    }
    static parseServerStatus(rawOutput, registryUrl) {
        const versionInfo = this.parseVersion(rawOutput);
        return {
            connected: !!versionInfo.server,
            url: versionInfo.url || registryUrl,
            version: versionInfo.server,
        };
    }
    static parseServers(rawOutput) {
        const clean = stripAnsi(rawOutput).trim();
        if (!clean || clean.includes('no servers') || clean.includes('connection refused')) {
            return [];
        }
        const servers = [];
        const lines = clean.split('\n').filter(l => l.trim() && !l.includes('───') && !l.includes('---'));
        let startIndex = 0;
        if (lines[0]?.toLowerCase().includes('name') || lines[0]?.includes('│')) {
            startIndex = 1;
        }
        for (let i = startIndex; i < lines.length; i++) {
            const line = lines[i]?.trim();
            if (!line)
                continue;
            if (line.includes('│') || line.includes('|')) {
                const parts = line.split(/[│|]/).map(p => p.trim()).filter(Boolean);
                if (parts.length >= 2) {
                    servers.push({
                        name: parts[0] || '',
                        transport: parts[1] || 'streamable_http',
                        url: parts[2],
                        enabled: parts[3]?.toLowerCase() !== 'disabled',
                    });
                }
            }
            else {
                const match = line.match(/^([^\s(]+)(?:\s+\(([^)]+)\))?/);
                if (match) {
                    servers.push({
                        name: match[1] || '',
                        transport: match[2] || 'streamable_http',
                        enabled: true,
                    });
                }
            }
        }
        return servers;
    }
    static parseTools(rawOutput) {
        const clean = stripAnsi(rawOutput).trim();
        if (!clean || clean.includes('no tools') || clean.includes('connection refused')) {
            return [];
        }
        const tools = [];
        const lines = clean.split('\n').filter(l => l.trim() && !l.includes('───') && !l.includes('---'));
        let startIndex = 0;
        if (lines[0]?.toLowerCase().includes('tool') || lines[0]?.includes('│')) {
            startIndex = 1;
        }
        for (let i = startIndex; i < lines.length; i++) {
            const line = lines[i]?.trim();
            if (!line)
                continue;
            let canonicalName = '';
            let description = '';
            if (line.includes('│') || line.includes('|')) {
                const parts = line.split(/[│|]/).map(p => p.trim()).filter(Boolean);
                canonicalName = parts[0] || '';
                description = parts[1] || '';
            }
            else {
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
    static parseToolSchema(rawOutput) {
        const clean = stripAnsi(rawOutput).trim();
        if (clean.includes('does not require any input parameters')) {
            return {
                type: 'object',
                properties: {},
                required: [],
            };
        }
        if (!clean.includes('Input Parameters:')) {
            return null;
        }
        const schema = {
            type: 'object',
            properties: {},
            required: [],
        };
        try {
            const paramsSection = clean.split('Input Parameters:')[1];
            if (!paramsSection)
                return null;
            const paramBlocks = paramsSection.split(/={3,}|−{3,}/);
            for (const block of paramBlocks) {
                const trimmed = block.trim();
                if (!trimmed || trimmed.length < 5)
                    continue;
                const nameMatch = trimmed.match(/^([a-zA-Z_][a-zA-Z0-9_]*)\s*\(([^)]+)\)/);
                if (!nameMatch)
                    continue;
                const [, paramName, requiredStatus] = nameMatch;
                if (!paramName)
                    continue;
                const jsonMatch = trimmed.match(/\{[\s\S]*?\}/);
                if (!jsonMatch)
                    continue;
                try {
                    const propSchema = JSON.parse(jsonMatch[0]);
                    schema.properties[paramName] = propSchema;
                    if (requiredStatus?.toLowerCase().includes('required')) {
                        schema.required.push(paramName);
                    }
                }
                catch (jsonError) {
                    continue;
                }
            }
            return Object.keys(schema.properties).length > 0 ? schema : null;
        }
        catch (error) {
            return this.parseSchemaFromText(clean);
        }
    }
    static parseSchemaFromText(text) {
        const schema = {
            type: 'object',
            properties: {},
            required: [],
        };
        const paramMatches = text.matchAll(/([a-zA-Z_][a-zA-Z0-9_]*)\s*\((required|optional)\)/gi);
        for (const match of paramMatches) {
            const [, name, requiredStatus] = match;
            if (name) {
                schema.properties[name] = {
                    type: 'string',
                    description: `Parameter: ${name}`,
                };
                if (requiredStatus?.toLowerCase() === 'required') {
                    schema.required.push(name);
                }
            }
        }
        return Object.keys(schema.properties).length > 0 ? schema : null;
    }
    static parsePrompts(rawOutput) {
        const clean = stripAnsi(rawOutput).trim();
        if (!clean || clean.includes('no prompts') || clean.includes('connection refused')) {
            return [];
        }
        const prompts = [];
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
    static parseGroups(rawOutput) {
        const clean = stripAnsi(rawOutput).trim();
        if (!clean || clean.includes('no groups') || clean.includes('connection refused')) {
            return [];
        }
        const groups = [];
        const lines = clean.split('\n').filter(l => l.trim());
        for (const line of lines) {
            const parts = line.split(/\s{2,}/);
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
    static isError(rawOutput) {
        const clean = stripAnsi(rawOutput).toLowerCase();
        return (clean.includes('error') ||
            clean.includes('failed') ||
            clean.includes('connection refused') ||
            clean.includes('not found'));
    }
    static extractError(rawOutput) {
        const clean = stripAnsi(rawOutput);
        const errorMatch = clean.match(/(?:error|failed):\s*(.+?)(?:\n|$)/i);
        if (errorMatch) {
            return errorMatch[1].trim();
        }
        return clean.trim();
    }
    static parseGenericTable(output) {
        const clean = stripAnsi(output).trim();
        if (!clean || clean.includes('no ') || clean.includes('connection refused')) {
            return [];
        }
        if (this.looksLikeJson(clean)) {
            try {
                const parsed = JSON.parse(clean);
                return Array.isArray(parsed) ? parsed : [parsed];
            }
            catch {
            }
        }
        return this.parseTableToObjects(clean);
    }
    static looksLikeJson(text) {
        const trimmed = text.trim();
        return (trimmed.startsWith('{') || trimmed.startsWith('[')) &&
            (trimmed.endsWith('}') || trimmed.endsWith(']'));
    }
    static parseTableToObjects(table) {
        const lines = table.split('\n').map(l => l.trim()).filter(Boolean);
        if (lines.length === 0)
            return [];
        let headerLine = '';
        let headerIndex = -1;
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            if (!line)
                continue;
            if (this.isBoxLine(line))
                continue;
            if (!headerLine && !this.isSeparatorLine(line)) {
                headerLine = line;
                headerIndex = i;
                break;
            }
        }
        if (!headerLine)
            return [];
        const columns = this.detectColumnBoundaries(headerLine, lines[headerIndex + 1]);
        const headers = columns.map(col => {
            const header = headerLine.substring(col.start, col.end);
            return header ? header.trim().replace(/[│|]/g, '').trim() : '';
        }).filter(Boolean);
        if (headers.length === 0)
            return [];
        const rows = [];
        for (let i = headerIndex + 1; i < lines.length; i++) {
            const line = lines[i];
            if (!line)
                continue;
            if (this.isSeparatorLine(line) || this.isBoxLine(line))
                continue;
            const row = {};
            let hasData = false;
            columns.forEach((col, idx) => {
                if (idx < headers.length && line) {
                    const substr = line.substring(col.start, col.end);
                    const value = substr ? substr.trim().replace(/[│|]/g, '').trim() : '';
                    if (value && headers[idx]) {
                        row[headers[idx]] = value;
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
    static detectColumnBoundaries(header, nextLine) {
        const columns = [];
        if (nextLine && this.isSeparatorLine(nextLine)) {
            let inColumn = false;
            let start = 0;
            for (let i = 0; i < nextLine.length; i++) {
                const char = nextLine[i];
                if ((char === '-' || char === '─') && !inColumn) {
                    start = i;
                    inColumn = true;
                }
                else if (char !== '-' && char !== '─' && inColumn) {
                    columns.push({ start, end: i });
                    inColumn = false;
                }
            }
            if (inColumn) {
                columns.push({ start, end: nextLine.length });
            }
            if (columns.length > 0)
                return columns;
        }
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
            if (columns.length > 0)
                return columns;
        }
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
    static isSeparatorLine(line) {
        const cleaned = line.replace(/[│|┌┐└┘├┤┬┴┼]/g, '').trim();
        return cleaned.length > 0 && /^[-─═]+$/.test(cleaned);
    }
    static isBoxLine(line) {
        return /^[┌┐└┘├┤┬┴┼─│═║╔╗╚╝╠╣╦╩╬]+$/.test(line.trim());
    }
}
//# sourceMappingURL=parser.js.map