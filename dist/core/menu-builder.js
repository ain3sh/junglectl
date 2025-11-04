export class DynamicMenuBuilder {
    introspector;
    constructor(introspector) {
        this.introspector = introspector;
    }
    async buildMainMenu() {
        const structure = await this.introspector.getCommandStructure();
        const choices = [];
        const priorityOrder = [
            'list',
            'invoke',
            'register',
            'create',
            'get',
            'enable',
            'disable',
            'update',
            'delete',
            'deregister',
        ];
        for (const cmdName of priorityOrder) {
            const cmd = structure.commands.find(c => c.name === cmdName);
            if (cmd && this.isInteractive(cmd)) {
                choices.push(this.formatMenuItem(cmd));
            }
        }
        for (const cmd of structure.commands) {
            if (this.isInteractive(cmd) && !priorityOrder.includes(cmd.name)) {
                choices.push(this.formatMenuItem(cmd));
            }
        }
        choices.push({
            value: 'settings',
            name: '⚙️  Settings',
            description: 'Configure JungleCTL preferences',
        });
        choices.push({
            value: 'exit',
            name: '❌ Exit',
            description: 'Quit JungleCTL',
        });
        return choices;
    }
    async buildSubmenu(command) {
        const structure = await this.introspector.getCommandStructure();
        const subcommands = structure.subcommands.get(command);
        if (!subcommands || subcommands.length === 0) {
            return [];
        }
        const choices = subcommands.map(sub => this.formatSubmenuItem(command, sub));
        choices.push({
            value: 'back',
            name: '← Back',
            description: 'Return to main menu',
        });
        return choices;
    }
    isInteractive(cmd) {
        const excluded = [
            'start',
            'version',
            'init-server',
            'login',
            'usage',
        ];
        return !excluded.includes(cmd.name);
    }
    formatMenuItem(cmd) {
        const emoji = this.getCommandEmoji(cmd.name);
        const formattedName = this.formatCommandName(cmd.name);
        return {
            value: cmd.name,
            name: `${emoji} ${formattedName}`,
            description: cmd.description,
        };
    }
    formatSubmenuItem(parent, sub) {
        const emoji = this.getSubcommandEmoji(parent, sub.name);
        const formattedName = this.formatCommandName(sub.name);
        return {
            value: sub.name,
            name: `${emoji} ${formattedName}`,
            description: sub.description,
        };
    }
    getCommandEmoji(command) {
        const emojiMap = {
            'list': '📋',
            'invoke': '🔧',
            'register': '➕',
            'get': '🔍',
            'create': '✨',
            'delete': '🗑️',
            'enable': '✅',
            'disable': '❌',
            'update': '🔄',
            'deregister': '➖',
        };
        return emojiMap[command] || '📄';
    }
    getSubcommandEmoji(_parent, subcommand) {
        const resourceEmojiMap = {
            'servers': '🔌',
            'tools': '🔧',
            'groups': '📦',
            'group': '📦',
            'prompts': '💬',
            'prompt': '💬',
            'users': '👤',
            'user': '👤',
            'mcp-clients': '🤖',
            'mcp-client': '🤖',
            'workflows': '🔄',
            'workflow': '🔄',
            'templates': '📝',
            'template': '📝',
            'tool': '🔧',
            'server': '🔌',
        };
        return resourceEmojiMap[subcommand] || '📄';
    }
    formatCommandName(name) {
        if (name.includes('-')) {
            return name
                .split('-')
                .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                .join(' ');
        }
        return name.charAt(0).toUpperCase() + name.slice(1);
    }
    getUserFriendlyName(command) {
        const nameMap = {
            'list': 'Browse Resources',
            'invoke': 'Invoke Tool',
            'register': 'Register MCP Server',
            'create': 'Create',
            'get': 'View Details',
            'delete': 'Delete',
            'enable': 'Enable',
            'disable': 'Disable',
            'update': 'Update',
            'deregister': 'Deregister Server',
        };
        return nameMap[command] || this.formatCommandName(command);
    }
}
//# sourceMappingURL=menu-builder.js.map