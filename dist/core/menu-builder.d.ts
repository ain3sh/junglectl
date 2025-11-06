export interface MenuChoice {
    value: string;
    name: string;
    description?: string;
}
export declare class DynamicMenuBuilder {
    private introspector;
    constructor(_config: any);
    buildMainMenu(): Promise<MenuChoice[]>;
    buildSubmenu(command: string): Promise<MenuChoice[]>;
    private isInteractive;
    private formatMenuItem;
    private formatSubmenuItem;
    private getCommandEmoji;
    private getSubcommandEmoji;
    private formatCommandName;
    getUserFriendlyName(command: string): string;
}
//# sourceMappingURL=menu-builder.d.ts.map