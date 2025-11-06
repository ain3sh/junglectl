export interface ParsedCommand {
    name: string;
    description: string;
    aliases: string[];
    confidence: number;
    origin: BlockOrigin;
}
export interface ParsedOption {
    long?: string;
    short?: string;
    aliases: string[];
    takesValue: boolean;
    argument?: string;
    defaultValue?: string;
    description: string;
    confidence: number;
    origin: BlockOrigin;
}
export interface UsagePattern {
    raw: string;
    tokens: string[];
    confidence: number;
    origin: BlockOrigin;
}
export interface ParseTelemetry {
    documentLines: number;
    normalizedLines: number;
    sectionsDetected: number;
    commandBlocks: number;
    optionBlocks: number;
    tableBlocks: number;
    averageCommandConfidence: number;
    averageOptionConfidence: number;
    warnings: string[];
}
export interface ParsedHelpDocument {
    commands: ParsedCommand[];
    options: ParsedOption[];
    usages: UsagePattern[];
    sections: HelpSection[];
    telemetry: ParseTelemetry;
}
interface HelpSection {
    header?: string;
    depth: number;
    startLine: number;
    endLine: number;
    blocks: HelpBlock[];
}
type HelpBlockRole = 'option-list' | 'command-list' | 'comma-list' | 'usage' | 'table' | 'kv' | 'paragraph';
interface HelpBlock {
    role: HelpBlockRole;
    lines: HelpLine[];
    score: BlockScore;
    startLine: number;
    endLine: number;
}
interface HelpLine {
    raw: string;
    text: string;
    indent: number;
    tokens: LineToken[];
    index: number;
}
interface LineToken {
    value: string;
    kind: TokenKind;
    column: number;
}
type TokenKind = 'flag' | 'word' | 'arg' | 'punct' | 'comma' | 'colon' | 'eq' | 'bullet';
interface BlockScore {
    option: number;
    command: number;
    comma: number;
    usage: number;
    table: number;
    kv: number;
}
export interface BlockOrigin {
    sectionIndex: number;
    blockIndex: number;
    lineIndex: number;
}
interface TableColumnBoundary {
    start: number;
    end: number;
}
export declare class HelpParser {
    parse(rawOutput: string): ParsedHelpDocument;
    private normalizeLines;
    private segmentIntoSections;
    private extractEntities;
    private isHeaderLine;
}
export declare function detectTableColumns(lines: string[]): TableColumnBoundary[];
export type { HelpSection, HelpBlock, HelpBlockRole };
//# sourceMappingURL=help-parser.d.ts.map