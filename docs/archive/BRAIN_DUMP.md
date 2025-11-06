# 🧠 JungleCTL Brain Dump - Complete Context for Phase 3-5 Implementation

**Project**: JungleCTL - Interactive MCPJungle CLI Wrapper  
**Status**: MVP v1.0 Complete ✅ | Phases 3-5 Pending  
**Location**: `/mnt/d/Personal_Folders/Tocho/ain3sh/mcpjungle-cli`  
**Git**: Initialized locally, will push to remote after Phase 5

---

## 🎯 Mission & Context

### What This Is
JungleCTL is a **beautiful, interactive terminal UI** that wraps the MCPJungle CLI to eliminate flag memorization and JSON crafting hell. It's built using **node-pty** to spawn the actual `mcpjungle` binary as a subprocess, parse its output, and present it through **@inquirer/prompts** autocomplete searches and gorgeous **cli-table3** tables.

### Key Design Decisions (IMPORTANT!)
1. **Non-invasive**: Zero coupling to MCPJungle source code - we ONLY interact via the CLI
2. **node-pty approach**: We spawn `mcpjungle` commands in a PTY, capture output, parse it
3. **Caching strategy**: TTL-based cache (30-60s) for list operations to avoid hammering the server
4. **TypeScript strict mode**: Full type safety, ESM modules
5. **OS-agnostic**: Works on Linux/WSL, macOS, Windows (via ConPTY)

---

## 📁 Critical Files to Load in Context

When resuming work, load these files immediately:

### Core Architecture
- `@/src/core/executor.ts` - PTY command execution, THE HEART of the system
- `@/src/core/parser.ts` - Output parsing (ANSI stripping, regex extraction)
- `@/src/core/cache.ts` - TTL cache implementation

### Type Definitions (ESSENTIAL!)
- `@/src/types/mcpjungle.ts` - All MCPJungle data models (MUST match CLI output)
- `@/src/types/config.ts` - App configuration types

### UI Layer
- `@/src/ui/prompts.ts` - Reusable prompt builders (autocomplete, select, etc.)
- `@/src/ui/formatters.ts` - Table rendering, colors, status display

### Commands (Reference for patterns)
- `@/src/commands/register.ts` - Complex multi-step wizard example
- `@/src/commands/list.ts` - Simple list operations

### Entry Point
- `@/src/index.ts` - Main menu loop, error handling

### Documentation
- `@/USAGE.md` - User-facing documentation (keep updated!)
- `@/docs/MCPJUNGLE_README.md` - Official MCPJungle CLI reference

---

## ✅ What's Been Implemented (Phase 1-2)

### Phase 1: Foundation (100% Complete)
```typescript
// PTY Executor - spawns mcpjungle commands
class MCPJungleExecutor {
  async execute(args: string[], options?: ExecutorOptions): Promise<ExecutorResult>
  // Returns: { stdout, stderr, exitCode, duration }
  // Handles: timeout, output cleaning, error propagation
}

// Output Parser - extracts structured data
class OutputParser {
  static parseServers(rawOutput: string): MCPServer[]
  static parseTools(rawOutput: string): MCPTool[]
  static parseGroups(rawOutput: string): ToolGroup[]
  static parsePrompts(rawOutput: string): MCPPrompt[]
  static parseToolSchema(rawOutput: string): ToolSchema | null
  // IMPORTANT: Handles ANSI codes, table formats, error detection
}

// TTL Cache - performance optimization
class TTLCache {
  async get<T>(key: string, fetcher: () => Promise<T>, ttl?: number): Promise<T>
  invalidate(key?: string): void
  // Used for: 'servers', 'tools', 'groups', 'prompts'
}
```

### Phase 2: Core Commands (100% Complete)
```typescript
// Register Server - Interactive wizard
async function registerServerInteractive(registryUrl?: string): Promise<void>
// Supports: HTTP, STDIO, SSE transports
// Creates: JSON config → temp file → mcpjungle register -c
// Invalidates: 'servers' and 'tools' cache after registration

// List Operations
async function listServers(registryUrl?: string): Promise<void>
async function listTools(options: { serverFilter?, registryUrl? }): Promise<void>
async function listGroups(registryUrl?: string): Promise<void>
async function listPrompts(options: { serverFilter?, registryUrl? }): Promise<void>
async function browseInteractive(registryUrl?: string): Promise<void> // Menu-driven browsing
```

### UI Components (100% Complete)
```typescript
// Reusable Prompts
class Prompts {
  static async selectServer(message, registryUrl): Promise<string>
  static async selectTool(message, serverFilter?, registryUrl?): Promise<string>
  static async selectTransport(): Promise<TransportType>
  static async selectMultipleTools(message, registryUrl?): Promise<string[]>
  static async selectMultipleServers(message, registryUrl?): Promise<string[]>
  static async textInput(message, options): Promise<string>
  static async confirm(message, default): Promise<boolean>
  // All use @inquirer/search for autocomplete!
}

// Formatters
class Formatters {
  static serversTable(servers: MCPServer[]): string
  static toolsTable(tools: MCPTool[]): string
  static groupsTable(groups: ToolGroup[]): string
  static prettyJson(obj: any): string
  static header(title: string): string
  static success/error/warning/info(message: string): string
  static statusBar(status): string
}

// Spinners
class Spinner {
  start(message: string): void
  succeed/fail/warn/info(message?: string): void
}
async function withSpinner<T>(message, operation, options): Promise<T>
```

---

## 🚧 What's NOT Implemented Yet (Phases 3-5)

### Phase 3: Advanced Features (HIGH PRIORITY)

#### 3.1 Tool Invocation (`src/commands/invoke.ts`)
**The Big One!** This is the most complex feature.

```typescript
// Workflow:
// 1. User selects a tool (autocomplete search)
// 2. Fetch tool schema via: mcpjungle usage <canonical-tool-name>
// 3. Parse schema to extract input parameters
// 4. Build dynamic form from schema (JSON Schema → Inquirer prompts)
// 5. Collect user input for each parameter
// 6. Build JSON payload
// 7. Execute: mcpjungle invoke <tool> --input '{"param": "value"}'
// 8. Display result (pretty print JSON or raw output)

export async function invokeToolInteractive(registryUrl?: string): Promise<void> {
  // Step 1: Select tool
  const tool = await Prompts.selectTool('Select tool to invoke', undefined, registryUrl);
  
  // Step 2: Fetch schema
  const spinner = new Spinner();
  spinner.start('Fetching tool schema...');
  const result = await executor.execute(['usage', tool], { registryUrl });
  const schema = OutputParser.parseToolSchema(result.stdout);
  spinner.succeed('Schema loaded');
  
  if (!schema || !schema.properties) {
    console.log(Formatters.warning('No schema available - tool might not accept input'));
    const proceed = await Prompts.confirm('Invoke anyway?', false);
    if (!proceed) return;
  }
  
  // Step 3: Build dynamic form
  const input = await buildDynamicForm(schema);
  
  // Step 4: Confirm & execute
  console.log('\n' + Formatters.prettyJson(input));
  const confirmed = await Prompts.confirm('Execute this tool?', true);
  if (!confirmed) return;
  
  spinner.start('Executing tool...');
  const invokeResult = await executor.execute(
    ['invoke', tool, '--input', JSON.stringify(input)],
    { registryUrl, timeout: 60000 }
  );
  spinner.succeed('Execution complete');
  
  // Step 5: Display result
  console.log('\n' + Formatters.header('Result'));
  console.log(Formatters.prettyJson(JSON.parse(invokeResult.stdout)));
}

// Helper: Build form from JSON Schema
async function buildDynamicForm(schema: ToolSchema): Promise<Record<string, any>> {
  const input: Record<string, any> = {};
  
  if (!schema.properties) return input;
  
  for (const [key, prop] of Object.entries(schema.properties)) {
    const isRequired = schema.required?.includes(key) || false;
    
    // Build prompt based on type
    let value: any;
    
    if (prop.enum) {
      // Enum → select
      value = await Prompts.select(
        `${key}${isRequired ? ' (required)' : ''}${prop.description ? ` - ${prop.description}` : ''}`,
        prop.enum.map(v => ({ value: v, name: String(v) }))
      );
    } else if (prop.type === 'boolean') {
      // Boolean → confirm
      value = await Prompts.confirm(
        `${key}${prop.description ? ` - ${prop.description}` : ''}`,
        prop.default !== undefined ? prop.default : true
      );
    } else if (prop.type === 'number' || prop.type === 'integer') {
      // Number → input with validation
      const strValue = await Prompts.textInput(
        `${key} (${prop.type})${isRequired ? ' (required)' : ''}${prop.description ? ` - ${prop.description}` : ''}`,
        {
          required: isRequired,
          default: prop.default !== undefined ? String(prop.default) : undefined,
          validate: (val) => {
            const num = Number(val);
            if (isNaN(num)) return 'Must be a valid number';
            if (prop.type === 'integer' && !Number.isInteger(num)) return 'Must be an integer';
            return true;
          }
        }
      );
      value = Number(strValue);
    } else if (prop.type === 'array') {
      // Array → comma-separated input (or multi-select if items.enum exists)
      const strValue = await Prompts.textInput(
        `${key} (comma-separated)${isRequired ? ' (required)' : ''}${prop.description ? ` - ${prop.description}` : ''}`,
        { required: isRequired }
      );
      value = strValue.split(',').map(v => v.trim());
    } else {
      // String or unknown → text input
      value = await Prompts.textInput(
        `${key}${isRequired ? ' (required)' : ''}${prop.description ? ` - ${prop.description}` : ''}`,
        {
          required: isRequired,
          default: prop.default,
        }
      );
    }
    
    input[key] = value;
  }
  
  return input;
}
```

**Testing Strategy for Invoke:**
1. Test with simple tool (e.g., `calculator__add` with two number inputs)
2. Test with complex tool (multiple param types)
3. Test with tool that has no schema
4. Test error handling (invalid JSON, tool failure)

---

#### 3.2 Tool Groups Management (`src/commands/groups.ts`)

```typescript
// CREATE GROUP
export async function createGroupInteractive(registryUrl?: string): Promise<void> {
  console.log(Formatters.header('Create Tool Group'));
  
  // Basic info
  const name = await Prompts.textInput('Group name', {
    required: true,
    validate: (val) => /^[a-zA-Z0-9_-]+$/.test(val) || 'Alphanumeric only'
  });
  
  const description = await Prompts.textInput('Description (optional)');
  
  // Strategy selection
  const strategy = await Prompts.select('How to build this group?', [
    { value: 'tools', name: 'Pick Specific Tools', description: 'Cherry-pick individual tools' },
    { value: 'servers', name: 'Include Entire Servers', description: 'Include all tools from servers' },
    { value: 'mixed', name: 'Mixed Approach', description: 'Combine tools + servers + exclusions' }
  ]);
  
  const config: ToolGroupConfig = { name };
  if (description) config.description = description;
  
  if (strategy === 'tools' || strategy === 'mixed') {
    const tools = await Prompts.selectMultipleTools('Select tools to include', registryUrl);
    if (tools.length > 0) config.included_tools = tools;
  }
  
  if (strategy === 'servers' || strategy === 'mixed') {
    const servers = await Prompts.selectMultipleServers('Select servers to include', registryUrl);
    if (servers.length > 0) config.included_servers = servers;
  }
  
  if (strategy === 'mixed') {
    const wantExclusions = await Prompts.confirm('Add exclusions?', false);
    if (wantExclusions) {
      const excluded = await Prompts.selectMultipleTools('Select tools to EXCLUDE', registryUrl);
      if (excluded.length > 0) config.excluded_tools = excluded;
    }
  }
  
  // Review & confirm
  console.log('\n' + Formatters.prettyJson(config));
  const confirmed = await Prompts.confirm('Create this group?', true);
  if (!confirmed) return;
  
  // Execute
  const tempFile = path.join(os.tmpdir(), `group-${Date.now()}.json`);
  await fs.writeFile(tempFile, JSON.stringify(config, null, 2));
  
  await executor.execute(['create', 'group', '-c', tempFile], { registryUrl });
  await fs.unlink(tempFile);
  
  cache.invalidate('groups');
  console.log(Formatters.success(`Group "${name}" created!`));
}

// GET GROUP DETAILS
export async function viewGroupInteractive(registryUrl?: string): Promise<void> {
  const group = await Prompts.selectGroup('Select group to view', registryUrl);
  
  const result = await executor.execute(['get', 'group', group], { registryUrl });
  // Parse and display group details
  console.log('\n' + result.stdout); // Or parse into structured format
}

// DELETE GROUP
export async function deleteGroupInteractive(registryUrl?: string): Promise<void> {
  const group = await Prompts.selectGroup('Select group to delete', registryUrl);
  
  const confirmed = await Prompts.confirm(`Delete group "${group}"?`, false);
  if (!confirmed) return;
  
  await executor.execute(['delete', 'group', group], { registryUrl });
  cache.invalidate('groups');
  
  console.log(Formatters.success(`Group "${group}" deleted`));
}

// GROUPS MENU
export async function groupsMenuInteractive(registryUrl?: string): Promise<void> {
  while (true) {
    const action = await Prompts.select('Tool Groups', [
      { value: 'create', name: '➕ Create Group' },
      { value: 'view', name: '👁️  View Group Details' },
      { value: 'list', name: '📋 List All Groups' },
      { value: 'delete', name: '🗑️  Delete Group' },
      { value: 'back', name: '← Back' }
    ]);
    
    if (action === 'back') break;
    
    try {
      switch (action) {
        case 'create': await createGroupInteractive(registryUrl); break;
        case 'view': await viewGroupInteractive(registryUrl); break;
        case 'list': await listGroups(registryUrl); break;
        case 'delete': await deleteGroupInteractive(registryUrl); break;
      }
      await Prompts.confirm('Continue?', true);
    } catch (error) {
      console.error(Formatters.error(error.message));
      await Prompts.confirm('Continue?', true);
    }
  }
}
```

---

#### 3.3 Enable/Disable Management (`src/commands/enable-disable.ts`)

```typescript
export async function enableDisableMenuInteractive(registryUrl?: string): Promise<void> {
  while (true) {
    const action = await Prompts.select('Enable/Disable', [
      { value: 'disable-tool', name: '🔇 Disable Tool' },
      { value: 'enable-tool', name: '🔊 Enable Tool' },
      { value: 'disable-server', name: '🔇 Disable Server (all tools)' },
      { value: 'enable-server', name: '🔊 Enable Server' },
      { value: 'back', name: '← Back' }
    ]);
    
    if (action === 'back') break;
    
    try {
      if (action === 'disable-tool' || action === 'enable-tool') {
        const tool = await Prompts.selectTool('Select tool', undefined, registryUrl);
        const cmd = action === 'disable-tool' ? 'disable' : 'enable';
        
        await executor.execute([cmd, 'tool', tool], { registryUrl });
        cache.invalidate('tools');
        
        console.log(Formatters.success(`Tool ${action === 'disable-tool' ? 'disabled' : 'enabled'}`));
      } else {
        const server = await Prompts.selectServer('Select server', registryUrl);
        const cmd = action === 'disable-server' ? 'disable' : 'enable';
        
        await executor.execute([cmd, 'server', server], { registryUrl });
        cache.invalidate();
        
        console.log(Formatters.success(`Server ${action === 'disable-server' ? 'disabled' : 'enabled'}`));
      }
      
      await Prompts.confirm('Continue?', true);
    } catch (error) {
      console.error(Formatters.error(error.message));
      await Prompts.confirm('Continue?', true);
    }
  }
}
```

---

### Phase 4: Polish & UX (MEDIUM PRIORITY)

#### 4.1 Config File Persistence (`src/core/config.ts`)

```typescript
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

const CONFIG_DIR = path.join(os.homedir(), '.junglectl');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');

export async function loadConfig(): Promise<AppConfig> {
  try {
    const data = await fs.readFile(CONFIG_FILE, 'utf-8');
    return { ...DEFAULT_CONFIG, ...JSON.parse(data) };
  } catch {
    return DEFAULT_CONFIG;
  }
}

export async function saveConfig(config: AppConfig): Promise<void> {
  await fs.mkdir(CONFIG_DIR, { recursive: true });
  await fs.writeFile(CONFIG_FILE, JSON.stringify(config, null, 2));
}

// Update src/index.ts to use loadConfig()
```

#### 4.2 Better Error Handling

```typescript
// Add to src/utils/errors.ts
export class MCPJungleError extends Error {
  constructor(message: string, public cause?: Error) {
    super(message);
    this.name = 'MCPJungleError';
  }
}

export function handleError(error: unknown): void {
  if (error instanceof MCPJungleError) {
    console.error(Formatters.error(error.message));
    if (error.cause) {
      console.error(chalk.gray('Caused by: ' + error.cause.message));
    }
  } else if (error instanceof Error) {
    console.error(Formatters.error(error.message));
    
    // Provide helpful hints based on error message
    if (error.message.includes('connection refused')) {
      console.log(chalk.gray('\n💡 Tip: Make sure MCPJungle server is running:'));
      console.log(chalk.gray('   docker compose up -d'));
    } else if (error.message.includes('not found')) {
      console.log(chalk.gray('\n💡 Tip: Check resource name and try again'));
    }
  }
}
```

#### 4.3 Settings Editor

```typescript
// Update showSettings() in src/index.ts
async function showSettings(): Promise<void> {
  const config = await loadConfig();
  
  const action = await Prompts.select('Settings', [
    { value: 'view', name: '👁️  View Current Config' },
    { value: 'edit-url', name: '🔗 Change Registry URL' },
    { value: 'edit-cache', name: '⏱️  Change Cache TTL' },
    { value: 'reset', name: '🔄 Reset to Defaults' },
    { value: 'back', name: '← Back' }
  ]);
  
  if (action === 'edit-url') {
    const newUrl = await Prompts.textInput('Registry URL', {
      default: config.registryUrl,
      validate: (val) => {
        try { new URL(val); return true; }
        catch { return 'Invalid URL'; }
      }
    });
    config.registryUrl = newUrl;
    await saveConfig(config);
    console.log(Formatters.success('Registry URL updated'));
  }
  // ... other edit flows
}
```

---

### Phase 5: Testing & Distribution (LOW PRIORITY)

#### 5.1 Cross-Platform Testing
- **Linux/WSL**: ✅ Already tested
- **macOS**: Test PTY behavior, ConPTY not used
- **Windows Native**: Test ConPTY path in node-pty

#### 5.2 npm Package Setup
```json
// Add to package.json
{
  "name": "junglectl",
  "version": "1.0.0",
  "description": "Interactive CLI for MCPJungle",
  "bin": {
    "junglectl": "./dist/index.js",
    "jctl": "./dist/index.js"
  },
  "files": [
    "dist/",
    "docs/",
    "README.md",
    "LICENSE"
  ],
  "publishConfig": {
    "access": "public"
  }
}
```

#### 5.3 Installation Script
```bash
# Create install.sh
#!/bin/bash
npm install -g junglectl
echo "✅ JungleCTL installed! Run: junglectl"
```

---

## 🔑 Key Implementation Notes

### 1. Output Parsing is Fragile!
The `OutputParser` class relies on regex and text parsing. **Always test against actual mcpjungle output**. When adding new parsers:

```typescript
// Before implementing, run this to see actual output:
mcpjungle <command> 2>&1 | cat -A

// Then update parser accordingly
```

### 2. Cache Invalidation Rules
```typescript
// When to invalidate:
// - After register → invalidate('servers'), invalidate('tools')
// - After deregister → invalidate('servers'), invalidate('tools')
// - After enable/disable → invalidate('tools') or invalidate()
// - After create/delete group → invalidate('groups')
```

### 3. Error Handling Pattern
```typescript
try {
  const result = await executor.execute([...]);
  // Process result
} catch (error) {
  if (OutputParser.isError(result.stdout)) {
    throw new Error(OutputParser.extractError(result.stdout));
  }
  throw error;
}
```

### 4. Temp File Pattern (for JSON configs)
```typescript
const tempFile = path.join(os.tmpdir(), `mcpjungle-${Date.now()}.json`);
await fs.writeFile(tempFile, JSON.stringify(config, null, 2));
await executor.execute(['command', '-c', tempFile], { registryUrl });
await fs.unlink(tempFile).catch(() => {}); // Ignore cleanup errors
```

---

## 🧪 Testing Checklist

### Before Starting Phase 3
- [ ] Ensure MCPJungle server is running (`docker compose up -d`)
- [ ] Register at least 2 test servers (one HTTP, one STDIO)
- [ ] Verify `npm run dev` works
- [ ] Check cache is working (second list should be instant)

### Testing Tool Invocation
- [ ] Simple tool with 2 string params
- [ ] Tool with number/boolean params
- [ ] Tool with enum selection
- [ ] Tool with no schema
- [ ] Tool that fails (error handling)
- [ ] Tool with array input

### Testing Groups
- [ ] Create group with specific tools
- [ ] Create group with entire servers
- [ ] Create group with exclusions
- [ ] View group details
- [ ] Delete group
- [ ] Verify endpoint URL in output

---

## 📦 Dependencies Summary

### Production
```json
{
  "@inquirer/prompts": "^7.8.4",    // Core prompts
  "@inquirer/search": "^3.2.0",     // Autocomplete search
  "chalk": "^5.4.1",                // Colors
  "cli-table3": "^0.6.5",           // Tables
  "commander": "^12.1.0",           // CLI parser (future)
  "node-pty": "^1.1.0-beta22",      // PTY management ⚠️ THE HEART
  "ora": "^8.2.0",                  // Spinners
  "strip-ansi": "^7.1.0"            // ANSI removal
}
```

### Dev
```json
{
  "@types/node": "^22.17.1",
  "tsx": "^4.19.0",                 // Dev execution
  "typescript": "^5.6.0"
}
```

---

## 🚨 Common Pitfalls & Solutions

### Pitfall 1: ANSI Codes in Output
**Problem**: Tables/output have escape codes  
**Solution**: Always use `stripAnsi()` before parsing text

### Pitfall 2: Cache Stale Data
**Problem**: UI shows old data after changes  
**Solution**: Call `cache.invalidate(key)` after mutations

### Pitfall 3: PTY Command Echo
**Problem**: Output contains the command itself  
**Solution**: `cleanOutput()` in executor removes this

### Pitfall 4: Timeout on Slow Operations
**Problem**: Tool invocation times out  
**Solution**: Set longer timeout: `{ timeout: 60000 }`

### Pitfall 5: Windows Path Issues
**Problem**: Temp file paths fail on Windows  
**Solution**: Use `os.tmpdir()` and `path.join()`, never hardcode `/tmp`

---

## 🎯 Next Session Checklist

When you resume work:

1. **Load these files first**:
   - `@/src/core/executor.ts`
   - `@/src/core/parser.ts`
   - `@/src/types/mcpjungle.ts`
   - `@/src/ui/prompts.ts`

2. **Start with Phase 3.1** (Tool Invocation):
   - Create `src/commands/invoke.ts`
   - Implement `buildDynamicForm()` helper
   - Test with `calculator__add` first
   - Add to main menu

3. **Then Phase 3.2** (Groups):
   - Create `src/commands/groups.ts`
   - Implement create/view/delete flows
   - Add groups submenu to main menu

4. **Then Phase 3.3** (Enable/Disable):
   - Create `src/commands/enable-disable.ts`
   - Simple enable/disable flows
   - Add to main menu

5. **Polish & Test**:
   - Run through all workflows
   - Fix any parsing issues
   - Update USAGE.md

---

## 💡 Future Enhancement Ideas

- **Fuzzy Search**: Replace exact match with fuzzy matching (fuse.js)
- **History**: Save recent commands to ~/.junglectl/history.json
- **Favorites**: Star frequently used tools
- **Batch Operations**: Multi-select enable/disable
- **Export Configs**: Save server configs to file
- **Import Configs**: Bulk import from directory
- **Live Dashboard**: Real-time tool execution monitoring (using Ink)
- **Plugin System**: Allow custom commands
- **Aliases**: Short names for common workflows

---

## 🎓 Key Learnings

1. **node-pty is powerful but tricky**: Output cleaning is essential
2. **Inquirer autocomplete is amazing**: Users love the search UX
3. **Caching makes it snappy**: 30s TTL is perfect sweet spot
4. **TypeScript strict mode catches bugs early**: Worth the upfront effort
5. **Temp files work great for JSON configs**: Clean, simple, reliable

---

**Good luck with Phases 3-5!** 🚀

The foundation is rock-solid. The hard part (PTY execution, parsing, UI framework) is done. Now it's just adding features using the established patterns. You got this! 💪
