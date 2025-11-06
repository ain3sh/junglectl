export declare class EscapeKeyError extends Error {
    constructor();
}
export declare function withEscapeKey<T>(promptFn: () => Promise<T>): Promise<T>;
export declare function isUserCancellation(error: unknown): boolean;
export declare const KEYBOARD_HINTS: {
    navigation: string;
    multiSelect: string;
    input: string;
    search: string;
    confirm: string;
};
export declare function formatNavigationHint(type?: keyof typeof KEYBOARD_HINTS): string;
export declare function formatMainMenuHeader(): string;
export declare function formatSelectionCount(selected: number, total: number): string;
export declare const HELP_CONTENT: string;
export declare function displayHelp(): void;
//# sourceMappingURL=keyboard-handler.d.ts.map