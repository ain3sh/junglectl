/**
 * CLI Introspection System
 * Dynamically discovers MCPJungle's command structure by parsing help output
 */

import { MCPJungleExecutor } from './executor.js';
import { HelpParser, type ParsedHelpDocument, type ParseTelemetry } from './help-parser.js';

export interface Command {
  name: string;
  description: string;
  category: 'basic' | 'advanced';
  hasSubcommands?: boolean;
  confidence?: number;
  sectionIndex?: number;
}

export interface Subcommand {
  name: string;
  description: string;
  confidence?: number;
  path: string[];
}

export interface Flag {
  name: string;
  shorthand?: string;
  description: string;
  type: 'string' | 'boolean';
  default?: string;
}

export interface IntrospectionTelemetry {
  root?: ParseTelemetry;
  subcommands: Record<string, ParseTelemetry>;
  probes: ProbeEvent[];
}

export interface CommandStructure {
  commands: Command[];
  subcommands: Map<string, Subcommand[]>;
  telemetry: IntrospectionTelemetry;
  timestamp: number;
}

interface ProbeEvent {
  path: string[];
  args: string[];
  exitCode: number;
  duration: number;
  success: boolean;
}

interface HelpCapture {
  path: string[];
  args: string[];
  stdout: string;
  exitCode: number;
  duration: number;
}

const HELP_PROBES: ReadonlyArray<ReadonlyArray<string>> = [
  ['--help'],
  ['-h'],
  ['help'],
  ['--help', 'all'],
  ['--help', 'full'],
  ['--long'],
];

const MAX_PROBE_ATTEMPTS = 6;
const MAX_SUBCOMMAND_DEPTH = 2;
const MAX_SUBCOMMAND_PROBES = 14;

/**
 * CLI Introspection - discovers MCPJungle's command structure
 */
export class CLIIntrospector {
  private cache: CommandStructure | null = null;
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes
  private readonly executor: MCPJungleExecutor;
  private readonly parser = new HelpParser();
  private telemetry: IntrospectionTelemetry = { subcommands: {}, probes: [] };

  constructor(registryUrl?: string) {
    this.executor = new MCPJungleExecutor(registryUrl);
  }

  /**
   * Get command structure (cached)
   */
  async getCommandStructure(): Promise<CommandStructure> {
    if (this.cache && Date.now() - this.cache.timestamp < this.CACHE_TTL) {
      return this.cache;
    }

    const { commands, subcommands, telemetry } = await this.discoverStructure();

    this.cache = {
      commands,
      subcommands,
      telemetry,
      timestamp: Date.now(),
    };

    return this.cache;
  }

  private async discoverStructure(): Promise<{
    commands: Command[];
    subcommands: Map<string, Subcommand[]>;
    telemetry: IntrospectionTelemetry;
  }> {
    this.telemetry = { subcommands: {}, probes: [] };

    const rootCapture = await this.captureHelp([]);
    const parsedRoot = this.parser.parse(rootCapture.stdout);
    this.telemetry.root = parsedRoot.telemetry;

    const commands = this.toCommands(parsedRoot);

    const { subcommandMap, subTelemetry } = await this.discoverSubcommands(commands);
    this.telemetry.subcommands = subTelemetry;

    commands.forEach((command) => {
      if (subcommandMap.has(command.name)) {
        command.hasSubcommands = true;
      }
    });

    return { commands, subcommands: subcommandMap, telemetry: this.telemetry };
  }

  private async captureHelp(path: string[]): Promise<HelpCapture> {
    const trimmedPath = path.filter(Boolean);
    const attempts: string[][] = [];

    for (const probe of HELP_PROBES) {
      attempts.push([...trimmedPath, ...probe]);

      if (probe.length === 1 && probe[0] === 'help' && trimmedPath.length) {
        attempts.push(['help', ...trimmedPath]);
      }

      if (probe.length === 2 && probe[0] === '--help' && trimmedPath.length) {
        attempts.push([...trimmedPath, `${probe[0]}=${probe[1]}`]);
      }
    }

    const tried = new Set<string>();
    let fallback: HelpCapture | null = null;

    for (const args of attempts.slice(0, MAX_PROBE_ATTEMPTS)) {
      const key = args.join('\u0000');
      if (tried.has(key)) continue;
      tried.add(key);

      try {
        const result = await this.executor.execute(args, {
          timeout: Math.min(8000, 5000 + trimmedPath.length * 1000),
          acceptOutputOnError: true,
        });

        const capture: HelpCapture = {
          path: trimmedPath,
          args,
          stdout: result.stdout,
          exitCode: result.exitCode,
          duration: result.duration,
        };

        this.telemetry.probes.push({
          path: trimmedPath,
          args,
          exitCode: result.exitCode,
          duration: result.duration,
          success: result.stdout.trim().length > 0,
        });

        if (result.stdout.trim()) {
          return capture;
        }

        fallback = capture;
      } catch (error) {
        this.telemetry.probes.push({
          path: trimmedPath,
          args,
          exitCode: -1,
          duration: 0,
          success: false,
        });
      }
    }

    return (
      fallback ?? {
        path: trimmedPath,
        args: [...trimmedPath, '--help'],
        stdout: '',
        exitCode: -1,
        duration: 0,
      }
    );
  }

  private toCommands(parsed: ParsedHelpDocument): Command[] {
    const sectionOrder = Array.from(new Set(parsed.commands.map((cmd) => cmd.origin.sectionIndex))).sort(
      (a, b) => a - b
    );

    const sectionCategory = new Map<number, 'basic' | 'advanced'>();
    sectionOrder.forEach((sectionIndex, idx) => {
      sectionCategory.set(sectionIndex, idx === 0 ? 'basic' : 'advanced');
    });

    return parsed.commands
      .filter((cmd) => cmd.confidence >= 0.35)
      .map<Command>((cmd) => ({
        name: cmd.name,
        description: cmd.description,
        category: sectionCategory.get(cmd.origin.sectionIndex) ?? 'basic',
        confidence: cmd.confidence,
        sectionIndex: cmd.origin.sectionIndex,
      }))
      .sort((a, b) => (b.confidence ?? 0) - (a.confidence ?? 0));
  }

  private async discoverSubcommands(commands: Command[]): Promise<{
    subcommandMap: Map<string, Subcommand[]>;
    subTelemetry: Record<string, ParseTelemetry>;
  }> {
    const queue: Array<{ path: string[]; depth: number }> = [];
    const visited = new Set<string>();
    const subcommandMap = new Map<string, Subcommand[]>();
    const telemetry: Record<string, ParseTelemetry> = {};

    commands.forEach((command) => {
      if ((command.confidence ?? 0) >= 0.45) {
        queue.push({ path: [command.name], depth: 1 });
      }
    });

    let probesUsed = 0;

    while (queue.length && probesUsed < MAX_SUBCOMMAND_PROBES) {
      const current = queue.shift()!;
      const key = current.path.join(' ');

      if (current.depth > MAX_SUBCOMMAND_DEPTH) {
        continue;
      }

      if (visited.has(key)) {
        continue;
      }

      visited.add(key);
      probesUsed += 1;

      const capture = await this.captureHelp(current.path);
      if (!capture.stdout.trim()) {
        continue;
      }

      const parsed = this.parser.parse(capture.stdout);
      telemetry[key] = parsed.telemetry;

      const subcommands = this.toSubcommands(parsed, current.path);
      if (!subcommands.length) {
        continue;
      }

      const parentName = current.path[current.path.length - 1]!;
      if (current.depth === 1) {
        subcommandMap.set(parentName, subcommands);
      }

      if (current.depth < MAX_SUBCOMMAND_DEPTH) {
        subcommands.forEach((sub) => {
          if ((sub.confidence ?? 0) >= 0.5) {
            queue.push({ path: [...current.path, sub.name], depth: current.depth + 1 });
          }
        });
      }
    }

    return { subcommandMap, subTelemetry: telemetry };
  }

  private toSubcommands(parsed: ParsedHelpDocument, path: string[]): Subcommand[] {
    const parent = path[path.length - 1];
    const seen = new Set<string>();

    return parsed.commands
      .filter((cmd) => cmd.confidence >= 0.35 && cmd.name !== parent)
      .map<Subcommand>((cmd) => ({
        name: cmd.name,
        description: cmd.description,
        confidence: cmd.confidence,
        path: [...path, cmd.name],
      }))
      .filter((sub) => {
        const key = sub.name.toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .sort((a, b) => (b.confidence ?? 0) - (a.confidence ?? 0));
  }

  /**
   * Clear cache (useful for testing or force refresh)
   */
  clearCache(): void {
    this.cache = null;
  }

  getTelemetry(): IntrospectionTelemetry {
    return this.cache?.telemetry ?? this.telemetry;
  }
}
