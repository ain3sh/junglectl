import { createPrompt, useState, useKeypress, usePrefix, usePagination, useRef, useMemo, useEffect, isBackspaceKey, isEnterKey, isUpKey, isDownKey, isNumberKey, Separator, ValidationError, makeTheme, } from '@inquirer/core';
import { cursorHide } from '@inquirer/ansi';
import colors from 'yoctocolors-cjs';
import figures from '@inquirer/figures';
const selectTheme = {
    icon: { cursor: figures.pointer },
    style: {
        disabled: (text) => colors.dim(`- ${text}`),
        description: (text) => colors.cyan(text),
        keysHelpTip: (keys) => keys
            .map(([key, action]) => `${colors.bold(key)} ${colors.dim(action)}`)
            .join(colors.dim(' • ')),
    },
    helpMode: 'always',
    indexMode: 'hidden',
    keybindings: [],
};
function isSelectable(item) {
    return !Separator.isSeparator(item) && !item.disabled;
}
function isEscapeKey(key) {
    return key.name === 'escape';
}
function normalizeChoices(choices) {
    return choices.map((choice) => {
        if (Separator.isSeparator(choice))
            return choice;
        if (typeof choice === 'string') {
            return {
                value: choice,
                name: choice,
                short: choice,
                disabled: false,
            };
        }
        const name = choice.name ?? String(choice.value);
        const normalizedChoice = {
            value: choice.value,
            name,
            short: choice.short ?? name,
            disabled: choice.disabled ?? false,
        };
        if (choice.description) {
            normalizedChoice.description = choice.description;
        }
        return normalizedChoice;
    });
}
export default createPrompt((config, done) => {
    const { loop = true, pageSize = 7 } = config;
    const theme = makeTheme(selectTheme, config.theme);
    const { keybindings } = theme;
    const [status, setStatus] = useState('idle');
    const prefix = usePrefix({ status, theme });
    const searchTimeoutRef = useRef();
    const searchEnabled = !keybindings.includes('vim');
    const items = useMemo(() => normalizeChoices(config.choices), [config.choices]);
    const bounds = useMemo(() => {
        const first = items.findIndex(isSelectable);
        let last = -1;
        for (let i = items.length - 1; i >= 0; i--) {
            if (isSelectable(items[i])) {
                last = i;
                break;
            }
        }
        if (first === -1) {
            throw new ValidationError('[select prompt] No selectable choices. All choices are disabled.');
        }
        return { first, last };
    }, [items]);
    const defaultItemIndex = useMemo(() => {
        if (!('default' in config))
            return -1;
        return items.findIndex((item) => isSelectable(item) && item.value === config.default);
    }, [config.default, items]);
    const [active, setActive] = useState(defaultItemIndex === -1 ? bounds.first : defaultItemIndex);
    const selectedChoice = items[active];
    useKeypress((key, rl) => {
        clearTimeout(searchTimeoutRef.current);
        if (isEscapeKey(key)) {
            throw new Error('ExitPromptError');
        }
        else if (isEnterKey(key)) {
            setStatus('done');
            done(selectedChoice.value);
        }
        else if (isUpKey(key, keybindings) || isDownKey(key, keybindings)) {
            rl.clearLine(0);
            if (loop ||
                (isUpKey(key, keybindings) && active !== bounds.first) ||
                (isDownKey(key, keybindings) && active !== bounds.last)) {
                const offset = isUpKey(key, keybindings) ? -1 : 1;
                let next = active;
                do {
                    next = (next + offset + items.length) % items.length;
                } while (!isSelectable(items[next]));
                setActive(next);
            }
        }
        else if (isNumberKey(key) && !Number.isNaN(Number(rl.line))) {
            const selectedIndex = Number(rl.line) - 1;
            let selectableIndex = -1;
            const position = items.findIndex((item) => {
                if (Separator.isSeparator(item))
                    return false;
                selectableIndex++;
                return selectableIndex === selectedIndex;
            });
            const item = items[position];
            if (item != null && isSelectable(item)) {
                setActive(position);
            }
            searchTimeoutRef.current = setTimeout(() => {
                rl.clearLine(0);
            }, 700);
        }
        else if (isBackspaceKey(key)) {
            rl.clearLine(0);
        }
        else if (searchEnabled) {
            const searchTerm = rl.line.toLowerCase();
            const matchIndex = items.findIndex((item) => {
                if (Separator.isSeparator(item) || !isSelectable(item))
                    return false;
                const name = item.name || String(item.value);
                return name.toLowerCase().startsWith(searchTerm);
            });
            if (matchIndex !== -1) {
                setActive(matchIndex);
            }
            searchTimeoutRef.current = setTimeout(() => {
                rl.clearLine(0);
            }, 700);
        }
    });
    useEffect(() => () => {
        clearTimeout(searchTimeoutRef.current);
    }, []);
    const message = theme.style.message(config.message, status);
    let helpLine;
    if (theme.helpMode !== 'never') {
        if (config.instructions) {
            const { pager, navigation } = config.instructions;
            helpLine = theme.style.help(items.length > pageSize ? pager : navigation);
        }
        else {
            helpLine = theme.style.keysHelpTip([
                ['↑↓', 'navigate'],
                ['⏎', 'select'],
                ['esc', 'back'],
            ]);
        }
    }
    let separatorCount = 0;
    const page = usePagination({
        items,
        active,
        renderItem({ item, isActive }) {
            if (Separator.isSeparator(item)) {
                separatorCount++;
                return ` ${item.separator}`;
            }
            const line = item.name || String(item.value);
            if (item.disabled) {
                const disabledLabel = typeof item.disabled === 'string' ? item.disabled : '(disabled)';
                return theme.style.disabled(`${line} ${disabledLabel}`);
            }
            const icon = isActive ? theme.icon.cursor : ' ';
            const prefix = theme.indexMode === 'number' ? `${active - separatorCount + 1}. ` : '';
            const color = isActive ? colors.cyan : (x) => x;
            const descriptionDisplay = item.description ? `\n  ${theme.style.description(item.description)}` : '';
            return color(`${icon} ${prefix}${line}`) + descriptionDisplay;
        },
        pageSize,
        loop,
    });
    return `${prefix} ${message}${helpLine ? `\n${helpLine}` : ''}\n${page}${cursorHide}`;
});
//# sourceMappingURL=custom-select.js.map