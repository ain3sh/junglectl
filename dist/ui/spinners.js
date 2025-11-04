import ora from 'ora';
export class Spinner {
    spinner = null;
    start(message) {
        this.spinner = ora({
            text: message,
            color: 'cyan',
        }).start();
    }
    update(message) {
        if (this.spinner) {
            this.spinner.text = message;
        }
    }
    succeed(message) {
        if (this.spinner) {
            this.spinner.succeed(message);
            this.spinner = null;
        }
    }
    fail(message) {
        if (this.spinner) {
            this.spinner.fail(message);
            this.spinner = null;
        }
    }
    warn(message) {
        if (this.spinner) {
            this.spinner.warn(message);
            this.spinner = null;
        }
    }
    info(message) {
        if (this.spinner) {
            this.spinner.info(message);
            this.spinner = null;
        }
    }
    stop() {
        if (this.spinner) {
            this.spinner.stop();
            this.spinner = null;
        }
    }
    isSpinning() {
        return this.spinner !== null && this.spinner.isSpinning;
    }
}
export async function withSpinner(message, operation, options = {}) {
    const spinner = new Spinner();
    spinner.start(message);
    try {
        const result = await operation();
        spinner.succeed(options.successMessage || message);
        return result;
    }
    catch (error) {
        spinner.fail(options.errorMessage || 'Operation failed');
        throw error;
    }
}
//# sourceMappingURL=spinners.js.map