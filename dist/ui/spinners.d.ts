export declare class Spinner {
    private spinner;
    start(message: string): void;
    update(message: string): void;
    succeed(message?: string): void;
    fail(message?: string): void;
    warn(message?: string): void;
    info(message?: string): void;
    stop(): void;
    isSpinning(): boolean;
}
export declare function withSpinner<T>(message: string, operation: () => Promise<T>, options?: {
    successMessage?: string;
    errorMessage?: string;
}): Promise<T>;
//# sourceMappingURL=spinners.d.ts.map