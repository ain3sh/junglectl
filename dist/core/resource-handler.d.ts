export declare class ResourceHandler {
    private executor;
    constructor(registryUrl?: string);
    listResource(resourceType: string, options?: {
        serverFilter?: string;
        registryUrl?: string;
    }): Promise<void>;
    private parseResourceOutput;
    private displayResource;
    private formatResource;
    private capitalize;
}
//# sourceMappingURL=resource-handler.d.ts.map