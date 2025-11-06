import chalk from 'chalk';
export class EscapeKeyError extends Error {
    constructor() {
        super('User pressed ESC');
        this.name = 'EscapeKeyError';
    }
}
export async function withEscapeKey(promptFn) {
    try {
        return await promptFn();
    }
    catch (error) {
        if (error instanceof Error && error.name === 'ExitPromptError') {
            throw new EscapeKeyError();
        }
        throw error;
    }
}
export function isUserCancellation(error) {
    return (error instanceof EscapeKeyError ||
        (error instanceof Error && error.name === 'ExitPromptError'));
}
export const KEYBOARD_HINTS = {
    navigation: '↑↓ navigate • ⏎ select • esc back',
    multiSelect: '↑↓ navigate • space select/deselect • ⏎ confirm',
    input: '⏎ confirm • esc cancel',
    search: 'type to filter • ↑↓ navigate • ⏎ select • esc back',
    confirm: 'y/n or ⏎ • esc cancel',
};
export function formatNavigationHint(type = 'navigation') {
    const separator = chalk.gray('━'.repeat(60));
    return separator + '\n' + chalk.gray(KEYBOARD_HINTS[type]) + '\n\n';
}
export function formatMainMenuHeader() {
    return chalk.gray('Use Ctrl+C to exit, or select Exit from menu\n\n');
}
export function formatSelectionCount(selected, total) {
    if (selected === 0) {
        return chalk.gray(`0 selected of ${total}`);
    }
    return chalk.cyan(`✓ ${selected} selected`) + chalk.gray(` of ${total}`);
}
export const HELP_CONTENT = `
${chalk.cyan.bold('📖 climb Keyboard Shortcuts')}

${chalk.bold('Navigation:')}
  ↑/↓         Navigate through options
  ⏎ (Enter)   Select/confirm current option
  ESC         Go back to previous menu
  Ctrl+C      Exit application

${chalk.bold('List/Select Prompts:')}
  Type        Start filtering/searching
  ↑/↓         Navigate filtered results
  ⏎           Select current item
  ESC         Cancel and go back

${chalk.bold('Multi-Select (Checkbox) Prompts:')}
  Space       Select/deselect current item
  a           Toggle all items
  i           Invert selection
  ↑/↓         Navigate through items
  ⏎           Confirm selection
  ESC         Cancel and go back

${chalk.bold('Text Input:')}
  Type        Enter text
  ⏎           Confirm input
  ESC         Cancel input
  Ctrl+U      Clear line
  Ctrl+K      Clear to end

${chalk.bold('Tips:')}
  • ESC always goes back one level (never exits app)
  • Ctrl+C exits immediately from main menu
  • Space bar is for selecting/deselecting in multi-select only
  • Start typing to search/filter in any list
  • "Back" option available as fallback on all menus

${chalk.gray('Press any key to close this help...')}
`;
export function displayHelp() {
    console.clear();
    console.log(HELP_CONTENT);
}
//# sourceMappingURL=keyboard-handler.js.map