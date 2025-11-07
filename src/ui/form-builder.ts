/**
 * Dynamic Form Builder
 * Generates interactive forms from JSON Schema definitions
 */

import { input, confirm } from '@inquirer/prompts';
import customSelect from './custom-select.js';
import type { ToolSchema, SchemaProperty } from '../types/mcpjungle.js';
import { ValidationError } from '../utils/errors.js';
import chalk from 'chalk';

/**
 * Build dynamic form from JSON Schema
 * Returns key-value object with user input
 */
export async function buildDynamicForm(schema: ToolSchema): Promise<Record<string, any>> {
  const result: Record<string, any> = {};

  // Handle empty schema
  if (!schema.properties || Object.keys(schema.properties).length === 0) {
    console.log(chalk.gray('ℹ This tool does not require any input parameters.\n'));
    return result;
  }

  console.log(chalk.bold('\n📝 Fill in tool parameters:\n'));

  // Iterate through properties
  for (const [key, prop] of Object.entries(schema.properties)) {
    const isRequired = schema.required?.includes(key) || false;

    try {
      const value = await buildFieldInput(key, prop, isRequired);
      result[key] = value;
    } catch (error) {
      if (error instanceof Error && error.name === 'ExitPromptError') {
        // User cancelled (Ctrl+C)
        throw error;
      }
      throw new ValidationError(key, error instanceof Error ? error.message : String(error));
    }
  }

  return result;
}

/**
 * Build input prompt for a single field based on its schema
 */
async function buildFieldInput(
  key: string,
  prop: SchemaProperty,
  isRequired: boolean
): Promise<any> {
  const label = buildFieldLabel(key, prop, isRequired);

  // Handle enum (select dropdown)
  if (prop.enum && Array.isArray(prop.enum)) {
    return await buildEnumSelect(label, prop);
  }

  // Handle boolean (confirm prompt)
  if (prop.type === 'boolean') {
    return await buildBooleanInput(label, prop);
  }

  // Handle number/integer
  if (prop.type === 'number' || prop.type === 'integer') {
    return await buildNumberInput(label, prop, isRequired);
  }

  // Handle array
  if (prop.type === 'array') {
    return await buildArrayInput(label, prop, isRequired);
  }

  // Default: string input
  return await buildStringInput(label, prop, isRequired);
}

/**
 * Build field label with description and required indicator
 */
function buildFieldLabel(key: string, prop: SchemaProperty, isRequired: boolean): string {
  let label = chalk.cyan(key);

  if (isRequired) {
    label += chalk.red(' *');
  }

  if (prop.description) {
    label += chalk.gray(` - ${prop.description}`);
  }

  if (prop.type && !prop.enum) {
    label += chalk.gray(` (${prop.type})`);
  }

  return label;
}

/**
 * Build string input prompt
 */
async function buildStringInput(
  label: string,
  prop: SchemaProperty,
  isRequired: boolean
): Promise<string> {
  return input({
    message: label,
    default: prop.default !== undefined ? String(prop.default) : undefined,
    validate: (value) => {
      if (isRequired && !value.trim()) {
        return 'This field is required';
      }

      // Check min/max length
      if (prop.minLength !== undefined && value.length < prop.minLength) {
        return `Minimum length: ${prop.minLength}`;
      }
      if (prop.maxLength !== undefined && value.length > prop.maxLength) {
        return `Maximum length: ${prop.maxLength}`;
      }

      // Check pattern
      if (prop.pattern) {
        const regex = new RegExp(prop.pattern);
        if (!regex.test(value)) {
          return `Must match pattern: ${prop.pattern}`;
        }
      }

      return true;
    },
  });
}

/**
 * Build number input prompt with validation
 */
async function buildNumberInput(
  label: string,
  prop: SchemaProperty,
  isRequired: boolean
): Promise<number> {
  const stringValue = await input({
    message: label,
    default: prop.default !== undefined ? String(prop.default) : undefined,
    validate: (value) => {
      if (isRequired && !value.trim()) {
        return 'This field is required';
      }

      if (!value.trim() && !isRequired) {
        return true; // Empty optional field
      }

      const num = Number(value);
      if (isNaN(num)) {
        return 'Must be a valid number';
      }

      // Check integer constraint
      if (prop.type === 'integer' && !Number.isInteger(num)) {
        return 'Must be an integer (no decimals)';
      }

      // Check minimum
      if (prop.minimum !== undefined && num < prop.minimum) {
        return `Minimum value: ${prop.minimum}`;
      }

      // Check maximum
      if (prop.maximum !== undefined && num > prop.maximum) {
        return `Maximum value: ${prop.maximum}`;
      }

      return true;
    },
  });

  return Number(stringValue);
}

/**
 * Build boolean input prompt
 */
async function buildBooleanInput(
  label: string,
  prop: SchemaProperty
): Promise<boolean> {
  return confirm({
    message: label,
    default: prop.default !== undefined ? Boolean(prop.default) : true,
  });
}

/**
 * Build enum select prompt
 */
async function buildEnumSelect(
  label: string,
  prop: SchemaProperty
): Promise<any> {
  const choices = prop.enum!.map((value) => ({
    value,
    name: String(value),
    description: value === prop.default ? '(default)' : undefined,
  }));

  return customSelect({
    message: label,
    choices,
    default: prop.default,
    loop: false,
  });
}

/**
 * Build array input prompt (comma-separated)
 */
async function buildArrayInput(
  label: string,
  prop: SchemaProperty,
  isRequired: boolean
): Promise<any[]> {
  // Check if array items have enum (multi-select case)
  const items = prop.items as SchemaProperty | undefined;
  if (items?.enum && Array.isArray(items.enum)) {
    // TODO: Future enhancement - use checkbox for multi-select
    // For now, fall through to comma-separated
  }

  const stringValue = await input({
    message: label + chalk.gray(' (comma-separated)'),
    default: Array.isArray(prop.default) ? prop.default.join(', ') : undefined,
    validate: (value) => {
      if (isRequired && !value.trim()) {
        return 'This field is required';
      }

      if (!value.trim() && !isRequired) {
        return true;
      }

      // Check min/max items
      const items = value.split(',').map(v => v.trim()).filter(Boolean);
      if (prop.minItems !== undefined && items.length < prop.minItems) {
        return `Minimum ${prop.minItems} items required`;
      }
      if (prop.maxItems !== undefined && items.length > prop.maxItems) {
        return `Maximum ${prop.maxItems} items allowed`;
      }

      return true;
    },
  });

  // Parse comma-separated values
  const arrayResult = stringValue
    .split(',')
    .map(v => v.trim())
    .filter(Boolean);

  // Type coercion based on item type
  if (items?.type === 'number') {
    return arrayResult.map(Number);
  }
  if (items?.type === 'boolean') {
    return arrayResult.map(v => v.toLowerCase() === 'true');
  }

  return arrayResult;
}

/**
 * Manually collect JSON input (fallback for tools without schema)
 */
export async function buildManualJsonInput(): Promise<Record<string, any>> {
  console.log(chalk.yellow('\n⚠ This tool has no schema information.'));
  console.log(chalk.gray('You can provide JSON input manually or skip (for tools with no parameters).\n'));

  const shouldProvideInput = await confirm({
    message: 'Provide JSON input?',
    default: false,
  });

  if (!shouldProvideInput) {
    return {};
  }

  const jsonString = await input({
    message: 'Enter JSON input',
    default: '{}',
    validate: (value) => {
      try {
        JSON.parse(value);
        return true;
      } catch {
        return 'Invalid JSON format';
      }
    },
  });

  return JSON.parse(jsonString);
}
