import { MCPJungleExecutor } from './executor.js';
import { OutputParser } from './parser.js';
import { Formatters } from '../ui/formatters.js';
import { withSpinner } from '../ui/spinners.js';
import chalk from 'chalk';
export class ResourceHandler {
    executor;
    constructor(registryUrl) {
        this.executor = new MCPJungleExecutor(registryUrl);
    }
    async listResource(resourceType, options = {}) {
        const args = ['list', resourceType];
        if (options.serverFilter) {
            args.push('--server', options.serverFilter);
        }
        const data = await withSpinner(options.serverFilter
            ? `Fetching ${resourceType} for ${options.serverFilter}...`
            : `Fetching ${resourceType}...`, async () => {
            const exec = options.registryUrl ? new MCPJungleExecutor(options.registryUrl) : this.executor;
            const result = await exec.execute(args);
            return this.parseResourceOutput(resourceType, result.stdout);
        }, { successMessage: `${this.capitalize(resourceType)} loaded` });
        this.displayResource(resourceType, data);
    }
    parseResourceOutput(resourceType, output) {
        switch (resourceType) {
            case 'servers':
                return OutputParser.parseServers(output);
            case 'tools':
                return OutputParser.parseTools(output);
            case 'groups':
                return OutputParser.parseGroups(output);
            case 'prompts':
                return OutputParser.parsePrompts(output);
            default:
                return OutputParser.parseGenericTable(output);
        }
    }
    displayResource(resourceType, data) {
        if (data.length === 0) {
            console.log(chalk.yellow(`\nNo ${resourceType} available\n`));
            return;
        }
        const formattedTable = this.formatResource(resourceType, data);
        console.log('\n' + formattedTable + '\n');
        console.log(chalk.gray(`Total: ${data.length} ${resourceType}\n`));
    }
    formatResource(resourceType, data) {
        switch (resourceType) {
            case 'servers':
                return Formatters.serversTable(data);
            case 'tools':
                return Formatters.toolsTable(data);
            case 'groups':
                return Formatters.groupsTable(data);
            case 'prompts':
                return Formatters.promptsTable(data);
            default:
                return Formatters.genericTable(data);
        }
    }
    capitalize(str) {
        return str.charAt(0).toUpperCase() + str.slice(1);
    }
}
//# sourceMappingURL=resource-handler.js.map