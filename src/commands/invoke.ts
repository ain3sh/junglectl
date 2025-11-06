/**
 * Tool Invocation Command
 * Interactive workflow for executing MCP tools
 */

import { Prompts } from '../ui/prompts.js';
import { Formatters } from '../ui/formatters.js';
import { Spinner } from '../ui/spinners.js';
import { MCPJungleExecutor } from '../core/executor.js';
import { OutputParser } from '../core/parser.js';
import { buildDynamicForm, buildManualJsonInput } from '../ui/form-builder.js';
import {
  SchemaParsingError,
  ToolInvocationError,
  formatError,
  UserCancelledError,
} from '../utils/errors.js';
import chalk from 'chalk';
import { formatNavigationHint } from '../ui/keyboard-handler.js';

const executor = new MCPJungleExecutor();

/**
 * Interactive tool invocation workflow
 */
export async function invokeToolInteractive(registryUrl?: string): Promise<void> {
  console.log(Formatters.header('Invoke Tool'));
  console.log();
  process.stdout.write(formatNavigationHint('navigation'));

  try {
    // Step 1: Select tool
    console.log(chalk.bold('🔧 Select Tool\n'));
    const tool = await Prompts.selectTool('Which tool do you want to invoke?', undefined, registryUrl);

    // Step 2: Fetch tool schema
    console.log(chalk.bold('\n📋 Fetching Tool Schema\n'));
    const spinner = new Spinner();
    spinner.start(`Loading schema for ${tool}...`);

    // Create executor with registry URL if provided (legacy MCP support)
    const exec = registryUrl ? new MCPJungleExecutor(registryUrl) : executor;

    let schemaResult;
    try {
      schemaResult = await exec.execute(['usage', tool], {
        timeout: 10000,
      });
      spinner.succeed('Schema loaded');
    } catch (error) {
      spinner.fail('Failed to fetch schema');
      throw new SchemaParsingError(tool, error instanceof Error ? error : undefined);
    }

    // Step 3: Parse schema
    const schema = OutputParser.parseToolSchema(schemaResult.stdout);

    // Step 4: Collect input
    let input: Record<string, any>;

    if (!schema) {
      // No schema available - offer manual JSON input
      input = await buildManualJsonInput();
    } else {
      // Build form from schema
      try {
        input = await buildDynamicForm(schema);
      } catch (error) {
        if (error instanceof Error && error.name === 'ExitPromptError') {
          throw new UserCancelledError();
        }
        throw error;
      }
    }

    // Step 5: Preview and confirm
    console.log(chalk.bold('\n📦 Input Parameters:\n'));
    if (Object.keys(input).length === 0) {
      console.log(chalk.gray('  (no parameters)'));
    } else {
      console.log(Formatters.prettyJson(input));
    }

    const confirmed = await Prompts.confirm('\nExecute this tool?', true);
    if (!confirmed) {
      console.log(chalk.yellow('\n✗ Execution cancelled'));
      return;
    }

    // Step 6: Execute tool
    console.log(chalk.bold('\n🚀 Executing Tool\n'));
    spinner.start(`Running ${tool}...`);

    let invokeResult;
    try {
      invokeResult = await exec.execute(
        ['invoke', tool, '--input', JSON.stringify(input)],
        {
          timeout: 60000, // 60s timeout for slow tools
        }
      );
      spinner.succeed('Execution complete');
    } catch (error) {
      spinner.fail('Execution failed');

      // Parse error from output
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new ToolInvocationError(tool, errorMessage, error instanceof Error ? error : undefined);
    }

    // Step 7: Parse and display result
    console.log(chalk.bold('\n✨ Result:\n'));
    displayToolResult(invokeResult.stdout);

  } catch (error) {
    if (error instanceof UserCancelledError) {
      console.log(chalk.yellow('\n✗ Operation cancelled'));
      return;
    }

    console.error('\n' + formatError(error));
    throw error;
  }
}

/**
 * Display tool execution result
 */
function displayToolResult(rawOutput: string): void {
  const clean = rawOutput.trim();

  try {
    // Try to parse as JSON
    const result = JSON.parse(clean);

    // Check if it's an error result
    if (result.isError === true) {
      console.log(Formatters.error('Tool execution returned an error:'));
      if (result.content && Array.isArray(result.content)) {
        for (const item of result.content) {
          if (item.type === 'text') {
            console.log(chalk.red(item.text));
          }
        }
      } else {
        console.log(chalk.red(JSON.stringify(result, null, 2)));
      }
      return;
    }

    // Success result
    if (result.content && Array.isArray(result.content)) {
      for (const item of result.content) {
        displayContentItem(item);
      }
    } else if (result.structuredContent) {
      // Display structured content
      console.log(Formatters.prettyJson(result.structuredContent));
    } else {
      // Fallback: display raw JSON
      console.log(Formatters.prettyJson(result));
    }

  } catch (parseError) {
    // Not JSON - display as plain text
    console.log(clean);
  }
}

/**
 * Display individual content item from result
 */
function displayContentItem(item: any): void {
  switch (item.type) {
    case 'text':
      console.log(item.text);
      break;

    case 'image':
      console.log(chalk.cyan('📷 Image'));
      console.log(chalk.gray(`  MIME Type: ${item.mimeType || 'unknown'}`));
      console.log(chalk.gray(`  Data: ${item.data.substring(0, 50)}... (${item.data.length} chars)`));
      console.log(chalk.yellow('  (Image data not displayable in terminal)'));
      break;

    case 'audio':
      console.log(chalk.cyan('🎵 Audio'));
      console.log(chalk.gray(`  MIME Type: ${item.mimeType || 'unknown'}`));
      console.log(chalk.gray(`  Data: ${item.data.substring(0, 50)}... (${item.data.length} chars)`));
      console.log(chalk.yellow('  (Audio data not displayable in terminal)'));
      break;

    case 'resource_link':
      console.log(chalk.cyan('🔗 Resource Link'));
      console.log(chalk.gray(`  URI: ${item.uri}`));
      if (item.name) console.log(chalk.gray(`  Name: ${item.name}`));
      if (item.description) console.log(chalk.gray(`  Description: ${item.description}`));
      break;

    case 'resource':
      console.log(chalk.cyan('📄 Embedded Resource'));
      console.log(chalk.gray(`  URI: ${item.resource.uri}`));
      if (item.resource.mimeType) console.log(chalk.gray(`  MIME Type: ${item.resource.mimeType}`));
      if (item.resource.text) {
        console.log(chalk.white('\nContent:'));
        console.log(item.resource.text);
      }
      break;

    default:
      // Unknown content type
      console.log(chalk.yellow(`⚠ Unknown content type: ${item.type}`));
      console.log(Formatters.prettyJson(item));
  }

  console.log(); // Add spacing
}
