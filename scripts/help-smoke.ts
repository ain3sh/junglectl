import { HelpParser } from '../src/core/help-parser.js';
import { spawnSync } from 'child_process';

interface Case {
  label: string;
  command: string;
  args: string[];
  env?: NodeJS.ProcessEnv;
}

const cases: Case[] = [
  {
    label: 'git --help',
    command: 'git',
    args: ['--help'],
    env: { ...process.env, GIT_PAGER: 'cat', MANPAGER: 'cat', LESS: 'FRX' },
  },
  {
    label: 'npm --help',
    command: 'npm',
    args: ['--help'],
  },
  {
    label: 'python3 --help',
    command: 'python3',
    args: ['--help'],
  },
  {
    label: 'mcpjungle --help',
    command: 'mcpjungle',
    args: ['--help'],
  },
];

const parser = new HelpParser();

function runCase(entry: Case): void {
  const result = spawnSync(entry.command, entry.args, {
    env: entry.env ?? process.env,
    encoding: 'utf8',
    maxBuffer: 5 * 1024 * 1024,
  });

  const stdout = result.stdout ?? '';
  const stderr = result.stderr ?? '';
  const output = stdout.trim() ? stdout : stderr;

  console.log(`\n=== ${entry.label} (exit ${result.status ?? 'null'}) ===`);

  if (!output.trim()) {
    console.log('! no help text captured');
    return;
  }

  const parsed = parser.parse(output);

  console.log(
    `entities → commands ${parsed.commands.length}, options ${parsed.options.length}, usages ${parsed.usages.length}`
  );

  const commandPreview = parsed.commands
    .slice(0, 8)
    .map((c) => `${c.name}[${Math.round(c.confidence * 100)}%]`)
    .join(', ');

  const optionPreview = parsed.options
    .slice(0, 8)
    .map((o) => `${(o.long ?? o.short) ?? '<anon>'}[${Math.round(o.confidence * 100)}%]`)
    .join(', ');

  console.log('top commands:', commandPreview || '<none>');
  console.log('top options:', optionPreview || '<none>');

  if (parsed.telemetry.warnings.length) {
    console.log('warnings:', parsed.telemetry.warnings.join(' | '));
  }

  console.log(
    `telemetry: sections ${parsed.telemetry.sectionsDetected}, ` +
      `command blocks ${parsed.telemetry.commandBlocks}, option blocks ${parsed.telemetry.optionBlocks}`
  );
}

for (const entry of cases) {
  runCase(entry);
}
