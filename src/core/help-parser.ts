import stripAnsi from 'strip-ansi';

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

type HelpBlockRole =
  | 'option-list'
  | 'command-list'
  | 'comma-list'
  | 'usage'
  | 'table'
  | 'kv'
  | 'paragraph';

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

type TokenKind =
  | 'flag'
  | 'word'
  | 'arg'
  | 'punct'
  | 'comma'
  | 'colon'
  | 'eq'
  | 'bullet';

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

interface BlockExtractionContext {
  sectionIndex: number;
  blockIndex: number;
  block: HelpBlock;
}

interface NormalizedDocument {
  lines: HelpLine[];
  indentUnit: number;
  warnings: string[];
}

interface TableColumnBoundary {
  start: number;
  end: number;
}

const WRAP_WIDTH_MIN = 60;
const WRAP_WIDTH_MAX = 120;

export class HelpParser {
  parse(rawOutput: string): ParsedHelpDocument {
    const stripped = stripAnsi(rawOutput ?? '');
    const originalLines = stripped.split(/\r?\n/);

    const normalization = this.normalizeLines(originalLines);
    const sections = this.segmentIntoSections(normalization.lines, normalization.indentUnit);

    const extraction = this.extractEntities(sections);

    const telemetry: ParseTelemetry = {
      documentLines: originalLines.length,
      normalizedLines: normalization.lines.length,
      sectionsDetected: sections.length,
      commandBlocks: extraction.commandBlocks,
      optionBlocks: extraction.optionBlocks,
      tableBlocks: extraction.tableBlocks,
      averageCommandConfidence: averageConfidence(extraction.commands.map((c) => c.confidence)),
      averageOptionConfidence: averageConfidence(extraction.options.map((o) => o.confidence)),
      warnings: [...normalization.warnings, ...extraction.warnings],
    };

    return {
      commands: extraction.commands,
      options: extraction.options,
      usages: extraction.usages,
      sections,
      telemetry,
    };
  }

  private normalizeLines(lines: string[]): NormalizedDocument {
    const sanitized = lines.map((line) => line.replace(/\s+$/g, ''));

    const withoutPager = sanitized.filter((line) => !/^--More--/i.test(line.trim()));

    const indentCandidates: number[] = [];
    const normalized: HelpLine[] = [];
    const warnings: string[] = [];

    withoutPager.forEach((raw, index) => {
      const text = raw.replace(/\t/g, '  ');
      const indent = text.length - text.replace(/^\s+/, '').length;
      if (indent > 0) indentCandidates.push(indent);

      normalized.push({
        raw,
        text,
        indent,
        tokens: tokenizeLine(text),
        index,
      });
    });

    const indentUnit = dominantIndent(indentCandidates) || 2;

    const wrapWidth = detectWrapWidth(normalized.map((l) => l.text));
    if (wrapWidth) {
      const reflowed: HelpLine[] = [];
      for (let i = 0; i < normalized.length; i++) {
        const line = normalized[i];
        if (!line) {
          continue;
        }

        if (!line.text.trim()) {
          reflowed.push(line);
          continue;
        }

        const next = normalized[i + 1];
        const shouldJoin =
          next &&
          line.text.length >= wrapWidth - 8 &&
          line.text.length <= wrapWidth + 4 &&
          next.text.trim() &&
          next.indent > line.indent &&
          !/[.;:]\s*$/.test(line.text.trim());

        if (shouldJoin) {
          const joined = `${line.text} ${next.text.trim()}`.replace(/\s+/g, ' ');
          const newLine: HelpLine = {
            raw: joined,
            text: joined,
            indent: line.indent,
            tokens: tokenizeLine(joined),
            index: line.index,
          };
          reflowed.push(newLine);
          i += 1;
        } else {
          reflowed.push(line);
        }
      }

      return { lines: reflowed, indentUnit, warnings };
    }

    return { lines: normalized, indentUnit, warnings };
  }

  private segmentIntoSections(lines: HelpLine[], indentUnit: number): HelpSection[] {
    const sections: HelpSection[] = [];
    const defaultSection: HelpSection = {
      depth: 0,
      startLine: 0,
      endLine: lines.length - 1,
      blocks: [],
    };

    const stack: { depth: number; section: HelpSection }[] = [{ depth: 0, section: defaultSection }];

    const addSection = (headerLine: HelpLine, depth: number): HelpSection => {
      const header = headerLine.text.trim().replace(/:$/, '');
      const section: HelpSection = {
        header: header || undefined,
        depth,
        startLine: headerLine.index,
        endLine: headerLine.index,
        blocks: [],
      };

      while (stack.length && stack[stack.length - 1]!.depth >= depth) {
        stack.pop();
      }

      const parent = stack[stack.length - 1]?.section;
      if (parent) {
        parent.endLine = Math.max(parent.endLine, headerLine.index - 1);
      }

      sections.push(section);
      stack.push({ depth, section });
      return section;
    };

    let currentSection = defaultSection;
    let currentBlock: HelpBlock | null = null;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (!line) {
        continue;
      }
      const trimmed = line.text.trim();

      if (!trimmed) {
        if (currentBlock) {
          currentBlock.endLine = line.index - 1;
          currentSection.blocks.push(currentBlock);
          currentBlock = null;
        }
        continue;
      }

      const isHeader = this.isHeaderLine(line, lines[i + 1]);
      if (isHeader) {
        if (currentBlock) {
          currentBlock.endLine = line.index - 1;
          currentSection.blocks.push(currentBlock);
          currentBlock = null;
        }

        const depth = 1 + Math.max(0, Math.floor(line.indent / Math.max(indentUnit, 1)));
        currentSection = addSection(line, depth);
        continue;
      }

      if (!currentBlock) {
        currentBlock = {
          role: 'paragraph',
          lines: [],
          score: {
            option: 0,
            command: 0,
            comma: 0,
            usage: 0,
            table: 0,
            kv: 0,
          },
          startLine: line.index,
          endLine: line.index,
        };
      }

      currentBlock.lines.push(line);
      currentBlock.score = accumulateScores(currentBlock.lines);
      currentBlock.role = classifyBlock(currentBlock.score);
      currentBlock.endLine = line.index;
    }

    if (currentBlock) {
      currentSection.blocks.push(currentBlock);
    }

    if (defaultSection.blocks.length > 0 || !sections.length) {
      sections.unshift(defaultSection);
    }

    return sections;
  }

  private extractEntities(sections: HelpSection[]) {
    const commands: ParsedCommand[] = [];
    const options: ParsedOption[] = [];
    const usages: UsagePattern[] = [];
    const warnings: string[] = [];

    let commandBlocks = 0;
    let optionBlocks = 0;
    let tableBlocks = 0;

    sections.forEach((section, sectionIndex) => {
      section.blocks.forEach((block, blockIndex) => {
        const context: BlockExtractionContext = { sectionIndex, blockIndex, block };

        switch (block.role) {
          case 'command-list': {
            commandBlocks += 1;
            const extracted = extractCommandsFromBlock(context);
            commands.push(...extracted);
            break;
          }
          case 'comma-list': {
            const extracted = extractCommaSeparatedCommands(context);
            if (extracted.length) {
              commandBlocks += 1;
              commands.push(...extracted);
            }
            break;
          }
          case 'option-list': {
            optionBlocks += 1;
            const extracted = extractOptionsFromBlock(context);
            options.push(...extracted);
            break;
          }
          case 'usage': {
            const extracted = extractUsageFromBlock(context);
            usages.push(...extracted);
            break;
          }
          case 'table': {
            tableBlocks += 1;
            break;
          }
          default:
            break;
        }
      });
    });

    const mergedCommands = mergeCommands(commands);
    const mergedOptions = mergeOptions(options);

    return {
      commands: mergedCommands,
      options: mergedOptions,
      usages,
      warnings,
      commandBlocks,
      optionBlocks,
      tableBlocks,
    };
  }

  private isHeaderLine(line: HelpLine, next?: HelpLine): boolean {
    const trimmed = line.text.trim();
    if (!trimmed) return false;

    const endsWithColon = trimmed.endsWith(':');
    const isTitleCase = /^(?:[A-Z][A-Za-z0-9\-]*)(?:\s+[A-Z][A-Za-z0-9\-]*)*$/.test(trimmed);
    const isAllCaps = /^[A-Z0-9 \-]+$/.test(trimmed) && trimmed.length <= 50;

    const underlineMatch = next && /^[-=]{3,}\s*$/.test(next.text.trim());
    const increasedIndent = next && next.indent > line.indent;

    if (underlineMatch) return true;
    if (endsWithColon) return true;
    if ((isTitleCase || isAllCaps) && increasedIndent) return true;

    return false;
  }
}

function tokenizeLine(text: string): LineToken[] {
  const tokens: LineToken[] = [];
  const trimmed = text.trim();
  if (!trimmed) return tokens;

  const flagRegex = /(?:^|\s)(-{1,2}[A-Za-z0-9][\w-]*)(?=\s|\,|$)/g;
  let flagMatch: RegExpExecArray | null;
  while ((flagMatch = flagRegex.exec(text))) {
    tokens.push({ value: flagMatch[1]!, kind: 'flag', column: flagMatch.index + 1 });
  }

  for (let i = 0; i < text.length; i++) {
    const char = text[i]!;
    if (char === ',') {
      tokens.push({ value: ',', kind: 'comma', column: i });
    } else if (char === ':') {
      tokens.push({ value: ':', kind: 'colon', column: i });
    } else if (char === '=') {
      tokens.push({ value: '=', kind: 'eq', column: i });
    } else if (/[-•*]/.test(char) && (i === 0 || text[i - 1] === ' ')) {
      tokens.push({ value: char, kind: 'bullet', column: i });
    }
  }

  const argRegex = /<[^>]+>|\[[^\]]+\]|\b[A-Z][A-Z0-9_-]{2,}\b/g;
  let argMatch: RegExpExecArray | null;
  while ((argMatch = argRegex.exec(text))) {
    tokens.push({ value: argMatch[0]!, kind: 'arg', column: argMatch.index });
  }

  const wordRegex = /\b[\p{L}\d][\p{L}\d_-]{1,}\b/gu;
  let wordMatch: RegExpExecArray | null;
  while ((wordMatch = wordRegex.exec(text))) {
    tokens.push({ value: wordMatch[0]!, kind: 'word', column: wordMatch.index });
  }

  tokens.sort((a, b) => a.column - b.column);
  return tokens;
}

function dominantIndent(candidates: number[]): number | null {
  if (candidates.length === 0) return null;
  const counts = new Map<number, number>();
  candidates.forEach((value) => {
    const normalized = value <= 8 ? value : Math.round(value / 2);
    counts.set(normalized, (counts.get(normalized) || 0) + 1);
  });

  let best = candidates[0]!;
  let bestCount = 0;
  counts.forEach((count, indent) => {
    if (count > bestCount) {
      best = indent;
      bestCount = count;
    }
  });

  return best || null;
}

function detectWrapWidth(lines: string[]): number | null {
  const histogram = new Map<number, number>();
  lines.forEach((line) => {
    const len = line.trimEnd().length;
    if (len >= WRAP_WIDTH_MIN && len <= WRAP_WIDTH_MAX) {
      histogram.set(len, (histogram.get(len) || 0) + 1);
    }
  });

  let bestWidth: number | null = null;
  let bestCount = 3;
  histogram.forEach((count, width) => {
    if (count > bestCount) {
      bestWidth = width;
      bestCount = count;
    }
  });

  return bestWidth;
}

function accumulateScores(lines: HelpLine[]): BlockScore {
  const score: BlockScore = {
    option: 0,
    command: 0,
    comma: 0,
    usage: 0,
    table: 0,
    kv: 0,
  };

  if (!lines.length) return score;

  lines.forEach((line) => {
    const trimmed = line.text.trim();
    if (!trimmed) return;
    const feature = computeLineFeatures(line);

    score.option += feature.flagHead ? 1 : 0;
    score.command += feature.headGap ? 1 : 0;
    score.comma += feature.commaDensity;
    score.usage += feature.punctDensity;
    score.table += feature.tableLikelihood;
    score.kv += feature.kvLikelihood;
  });

  const factor = 1 / lines.length;
  (Object.keys(score) as (keyof BlockScore)[]).forEach((key) => {
    score[key] = score[key]! * factor;
  });

  return score;
}

function computeLineFeatures(line: HelpLine) {
  const trimmed = line.text.trim();
  const flagHead = /^-{1,2}[\w?]/.test(trimmed);
  const headGap = /\S\s{2,}\S/.test(trimmed);
  const takesValue = /-{1,2}[\w-]+\s*(?:=|\s)(?:<[^>]+>|\[[^\]]+\]|[A-Z][A-Z0-9_-]+)/.test(trimmed);
  const commaDensity = (trimmed.match(/,/g)?.length || 0) / Math.max(trimmed.length, 20);
  const punctMatches = trimmed.match(/[\[\]<>|]/g)?.length || 0;
  const punctDensity = punctMatches / Math.max(trimmed.length, 20);
  const containsPipes = /[│|]/.test(trimmed);
  const containsSeparator = /^[\s\t]*[-=]{3,}$/.test(trimmed);
  const kvLikelihood = /\b\w+\s*(?:=|:)\s*\S+/.test(trimmed) ? 1 : 0;
  const tableLikelihood = containsPipes || containsSeparator ? 1 : 0;

  return {
    flagHead,
    headGap,
    takesValue,
    commaDensity,
    punctDensity,
    kvLikelihood,
    tableLikelihood,
  };
}

function classifyBlock(score: BlockScore): HelpBlockRole {
  const optionScore = score.option + 0.5 * (score.option > 0.3 ? 1 : 0);
  const commandScore = score.command + 0.4 * (score.comma < 0.05 ? 1 : 0);
  const commaScore = score.comma > 0.08 ? score.comma * 5 : 0;
  const usageScore = score.usage;
  const tableScore = score.table;
  const kvScore = score.kv;

  const scores: Array<[HelpBlockRole, number]> = [
    ['option-list', optionScore],
    ['command-list', commandScore],
    ['comma-list', commaScore],
    ['usage', usageScore],
    ['table', tableScore],
    ['kv', kvScore],
    ['paragraph', 0],
  ];

  scores.sort((a, b) => b[1] - a[1]);
  const [role, value] = scores[0]!;
  return value >= 0.15 ? role : 'paragraph';
}

function extractCommandsFromBlock(context: BlockExtractionContext): ParsedCommand[] {
  const { block, sectionIndex, blockIndex } = context;
  const commands: ParsedCommand[] = [];
  let pending: ParsedCommand | null = null;

  block.lines.forEach((line, lineIndex) => {
    const trimmed = line.text.trim();
    if (!trimmed) return;

    const headMatch = trimmed.match(/^(\S+)(\s{2,})(.+)$/);
    if (headMatch) {
      if (pending) {
        commands.push(pending);
      }

      const name = headMatch[1] ?? '';
      const desc = headMatch[3] ?? '';
      if (!name) {
        pending = null;
        return;
      }

      pending = {
        name,
        description: desc.trim(),
        aliases: [],
        confidence: computeCommandConfidence(trimmed),
        origin: { sectionIndex, blockIndex, lineIndex },
      };
      return;
    }

    if (/[,，]/.test(trimmed) && trimmed.split(',').length > 2) {
      trimmed
        .split(/[,，]/)
        .map((token) => token.trim())
        .filter((token) => token.length > 0)
        .forEach((token) => {
          commands.push({
            name: token,
            description: '',
            aliases: [],
            confidence: 0.45,
            origin: { sectionIndex, blockIndex, lineIndex },
          });
        });
      pending = null;
      return;
    }

    if (pending && line.indent > 0) {
      pending.description = `${pending.description} ${trimmed}`.trim();
    }
  });

  if (pending) {
    commands.push(pending);
  }

  return commands;
}

function extractCommaSeparatedCommands(context: BlockExtractionContext): ParsedCommand[] {
  const { block, sectionIndex, blockIndex } = context;
  const combined = block.lines.map((l) => l.text).join(' ');
  const tokens = combined.split(/[,，]/).map((t) => t.trim());

  return tokens
    .filter((token) => token.length > 0 && /^[-_A-Za-z0-9]+$/.test(token))
    .map((token, idx) => ({
      name: token,
      description: '',
      aliases: [],
      confidence: 0.4,
      origin: { sectionIndex, blockIndex, lineIndex: idx },
    }));
}

function extractOptionsFromBlock(context: BlockExtractionContext): ParsedOption[] {
  const { block, sectionIndex, blockIndex } = context;
  const options: ParsedOption[] = [];
  let current: ParsedOption | null = null;
  let baselineIndent = 0;

  block.lines.forEach((line, lineIndex) => {
    const trimmed = line.text.trim();
    if (!trimmed) return;

    const parsed = parseOptionHead(trimmed);
    if (parsed) {
      if (current) {
        options.push(current);
      }

      const description = parsed.tail.trim();
      const option: ParsedOption = {
        long: parsed.long,
        short: parsed.short,
        aliases: parsed.aliases,
        takesValue: parsed.takesValue,
        argument: parsed.argument,
        defaultValue: parsed.defaultValue,
        description,
        confidence: parsed.confidence,
        origin: { sectionIndex, blockIndex, lineIndex },
      };

      current = option;
      baselineIndent = line.indent;
      return;
    }

    if (current && line.indent > baselineIndent) {
      current.description = `${current.description} ${trimmed}`.trim();
      const tailDefault = extractInlineDefault(trimmed);
      if (tailDefault && !current.defaultValue) {
        current.defaultValue = tailDefault;
      }
    }
  });

  if (current) {
    options.push(current);
  }

  return options;
}

function extractUsageFromBlock(context: BlockExtractionContext): UsagePattern[] {
  const { block, sectionIndex, blockIndex } = context;
  const lines = block.lines.map((line) => line.text.trim()).filter(Boolean);
  if (!lines.length) return [];

  return lines.map((line, idx) => ({
    raw: line,
    tokens: tokenizeUsage(line),
    confidence: 0.6,
    origin: { sectionIndex, blockIndex, lineIndex: idx },
  }));
}

function parseOptionHead(line: string) {
  const headMatch = line.match(/^(-{1,2}[\w-]+(?:\s*,\s*-{1,2}[\w-]+)*)\s*(?:[=\s]+(<[^>]+>|\[[^\]]+\]|[A-Z][A-Z0-9_-]+))?\s*(.*)$/);
  if (!headMatch) return null;

  const aliasesRaw = headMatch[1]!.split(/\s*,\s*/).filter(Boolean);
  const long = aliasesRaw.find((alias) => alias.startsWith('--'));
  const short = aliasesRaw.find((alias) => /^-[^-]$/.test(alias));
  const aliases = aliasesRaw.filter((alias) => alias !== long && alias !== short);
  const argument = headMatch[2]?.trim();
  const tail = headMatch[3] ?? '';
  const takesValue = Boolean(argument) || /\s(?:=|to)\s+/i.test(line);
  const defaultValue = extractInlineDefault(tail);
  const confidence = 0.5 + Math.min(0.4, aliasesRaw.length * 0.1 + (argument ? 0.1 : 0));

  return {
    long,
    short,
    aliases,
    argument,
    tail,
    takesValue,
    defaultValue,
    confidence,
  };
}

function extractInlineDefault(text: string): string | undefined {
  const defaultMatch = text.match(/default\s*(?:=|:)?\s*([^,;\s]+)/i);
  if (defaultMatch) {
    return defaultMatch[1];
  }
  return undefined;
}

function tokenizeUsage(line: string): string[] {
  return line.split(/\s+/).filter(Boolean);
}

function mergeCommands(commands: ParsedCommand[]): ParsedCommand[] {
  const map = new Map<string, ParsedCommand>();

  commands.forEach((command) => {
    const key = command.name.toLowerCase();
    const existing = map.get(key);
    if (!existing) {
      map.set(key, { ...command });
      return;
    }

    existing.description = mergeDescriptions(existing.description, command.description);
    existing.confidence = Math.max(existing.confidence, command.confidence);
    existing.aliases = Array.from(new Set([...existing.aliases, ...command.aliases]));
  });

  return Array.from(map.values()).sort((a, b) => b.confidence - a.confidence);
}

function mergeOptions(options: ParsedOption[]): ParsedOption[] {
  const map = new Map<string, ParsedOption>();

  options.forEach((option) => {
    const aliases = [option.long, option.short, ...option.aliases].filter(Boolean).map((alias) => alias!.toLowerCase());
    const key = aliases.sort().join('|');
    const existing = map.get(key);
    if (!existing) {
      map.set(key, { ...option, aliases: [...option.aliases] });
      return;
    }

    existing.description = mergeDescriptions(existing.description, option.description);
    existing.confidence = Math.max(existing.confidence, option.confidence);
    existing.defaultValue = existing.defaultValue || option.defaultValue;
    existing.argument = existing.argument || option.argument;
    existing.takesValue = existing.takesValue || option.takesValue;
    existing.aliases = Array.from(new Set([...existing.aliases, ...option.aliases]));
    if (!existing.long && option.long) existing.long = option.long;
    if (!existing.short && option.short) existing.short = option.short;
  });

  return Array.from(map.values()).sort((a, b) => b.confidence - a.confidence);
}

function mergeDescriptions(a: string, b: string): string {
  if (!a) return b;
  if (!b) return a;
  if (a.includes(b)) return a;
  if (b.includes(a)) return b;
  return `${a}; ${b}`;
}

function computeCommandConfidence(line: string): number {
  let confidence = 0.4;
  if (/\s{2,}/.test(line)) confidence += 0.25;
  if (/[A-Za-z]/.test(line)) confidence += 0.05;
  if (line.length < 80) confidence += 0.05;
  return Math.min(0.95, confidence);
}

function averageConfidence(values: number[]): number {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

// Table parsing utilities reserved for later in case we need row data.
export function detectTableColumns(lines: string[]): TableColumnBoundary[] {
  const width = Math.max(0, ...lines.map((line) => line.length));
  if (!width) return [];

  const gradients: number[] = Array(width).fill(0);
  lines.forEach((line) => {
    for (let i = 1; i < line.length; i++) {
      const left = line.charAt(i - 1);
      const right = line.charAt(i);
      if (left !== ' ' && right === ' ') {
        gradients[i] = (gradients[i] ?? 0) + 1;
      }
      if (left === ' ' && right !== ' ') {
        gradients[i] = (gradients[i] ?? 0) + 1;
      }
    }
  });

  const candidates = gradients
    .map((value, index) => ({ value, index }))
    .filter((point) => point.value >= 2)
    .map((point) => point.index);

  if (!candidates.length) return [];

  const boundaries: TableColumnBoundary[] = [];
  let lastIndex = 0;
  candidates.forEach((index) => {
    if (index - lastIndex > 1) {
      boundaries.push({ start: lastIndex, end: index });
      lastIndex = index;
    }
  });

  const lastBoundary = boundaries.length > 0 ? boundaries[boundaries.length - 1]! : null;
  if (!lastBoundary) {
    boundaries.push({ start: lastIndex, end: width });
    return boundaries;
  }

  if (lastBoundary.end < width) {
    boundaries.push({ start: lastBoundary.end, end: width });
  }

  return boundaries;
}

export type { HelpSection, HelpBlock, HelpBlockRole };
