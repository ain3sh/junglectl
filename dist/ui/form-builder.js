import { input, select, confirm } from '@inquirer/prompts';
import { ValidationError } from '../utils/errors.js';
import chalk from 'chalk';
export async function buildDynamicForm(schema) {
    const result = {};
    if (!schema.properties || Object.keys(schema.properties).length === 0) {
        console.log(chalk.gray('ℹ This tool does not require any input parameters.\n'));
        return result;
    }
    console.log(chalk.bold('\n📝 Fill in tool parameters:\n'));
    for (const [key, prop] of Object.entries(schema.properties)) {
        const isRequired = schema.required?.includes(key) || false;
        try {
            const value = await buildFieldInput(key, prop, isRequired);
            result[key] = value;
        }
        catch (error) {
            if (error instanceof Error && error.name === 'ExitPromptError') {
                throw error;
            }
            throw new ValidationError(key, error instanceof Error ? error.message : String(error));
        }
    }
    return result;
}
async function buildFieldInput(key, prop, isRequired) {
    const label = buildFieldLabel(key, prop, isRequired);
    if (prop.enum && Array.isArray(prop.enum)) {
        return await buildEnumSelect(label, prop);
    }
    if (prop.type === 'boolean') {
        return await buildBooleanInput(label, prop);
    }
    if (prop.type === 'number' || prop.type === 'integer') {
        return await buildNumberInput(label, prop, isRequired);
    }
    if (prop.type === 'array') {
        return await buildArrayInput(label, prop, isRequired);
    }
    return await buildStringInput(label, prop, isRequired);
}
function buildFieldLabel(key, prop, isRequired) {
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
async function buildStringInput(label, prop, isRequired) {
    return input({
        message: label,
        default: prop.default !== undefined ? String(prop.default) : undefined,
        validate: (value) => {
            if (isRequired && !value.trim()) {
                return 'This field is required';
            }
            if (prop.minLength !== undefined && value.length < prop.minLength) {
                return `Minimum length: ${prop.minLength}`;
            }
            if (prop.maxLength !== undefined && value.length > prop.maxLength) {
                return `Maximum length: ${prop.maxLength}`;
            }
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
async function buildNumberInput(label, prop, isRequired) {
    const stringValue = await input({
        message: label,
        default: prop.default !== undefined ? String(prop.default) : undefined,
        validate: (value) => {
            if (isRequired && !value.trim()) {
                return 'This field is required';
            }
            if (!value.trim() && !isRequired) {
                return true;
            }
            const num = Number(value);
            if (isNaN(num)) {
                return 'Must be a valid number';
            }
            if (prop.type === 'integer' && !Number.isInteger(num)) {
                return 'Must be an integer (no decimals)';
            }
            if (prop.minimum !== undefined && num < prop.minimum) {
                return `Minimum value: ${prop.minimum}`;
            }
            if (prop.maximum !== undefined && num > prop.maximum) {
                return `Maximum value: ${prop.maximum}`;
            }
            return true;
        },
    });
    return Number(stringValue);
}
async function buildBooleanInput(label, prop) {
    return confirm({
        message: label,
        default: prop.default !== undefined ? Boolean(prop.default) : true,
    });
}
async function buildEnumSelect(label, prop) {
    const choices = prop.enum.map((value) => ({
        value,
        name: String(value),
        description: value === prop.default ? '(default)' : undefined,
    }));
    return select({
        message: label,
        choices,
        default: prop.default,
    });
}
async function buildArrayInput(label, prop, isRequired) {
    const items = prop.items;
    if (items?.enum && Array.isArray(items.enum)) {
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
    const arrayResult = stringValue
        .split(',')
        .map(v => v.trim())
        .filter(Boolean);
    if (items?.type === 'number') {
        return arrayResult.map(Number);
    }
    if (items?.type === 'boolean') {
        return arrayResult.map(v => v.toLowerCase() === 'true');
    }
    return arrayResult;
}
export async function buildManualJsonInput() {
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
            }
            catch {
                return 'Invalid JSON format';
            }
        },
    });
    return JSON.parse(jsonString);
}
//# sourceMappingURL=form-builder.js.map