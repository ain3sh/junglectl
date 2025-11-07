/**
 * Custom Select Prompt with ESC Key Support
 * Wraps @inquirer/select to add ESC key handling
 */

import {
  createPrompt,
  useState,
  useKeypress,
  usePrefix,
  usePagination,
  useRef,
  useMemo,
  useEffect,
  isBackspaceKey,
  isEnterKey,
  isUpKey,
  isDownKey,
  isNumberKey,
  Separator,
  ValidationError,
  makeTheme,
  type Theme,
  type Keybinding,
  type Status,
} from '@inquirer/core';
import type { PartialDeep } from '@inquirer/type';
import { cursorHide } from '@inquirer/ansi';
import colors from 'yoctocolors-cjs';
import figures from '@inquirer/figures';

type SelectTheme = {
  icon: {
    cursor: string;
  };
  style: {
    disabled: (text: string) => string;
    description: (text: string) => string;
    keysHelpTip: (keys: [key: string, action: string][]) => string | undefined;
  };
  helpMode: 'always' | 'never' | 'auto';
  indexMode: 'hidden' | 'number';
  keybindings: ReadonlyArray<Keybinding>;
};

type Choice<Value> = {
  value: Value;
  name?: string;
  description?: string;
  short?: string;
  disabled?: boolean | string;
  type?: never;
};

type KeypressEvent = {
  name: string;
  ctrl: boolean;
};

const selectTheme: SelectTheme = {
  icon: { cursor: figures.pointer },
  style: {
    disabled: (text: string) => colors.dim(`- ${text}`),
    description: (text: string) => colors.cyan(text),
    keysHelpTip: (keys: [key: string, action: string][]) =>
      keys
        .map(([key, action]) => `${colors.bold(key)} ${colors.dim(action)}`)
        .join(colors.dim(' • ')),
  },
  helpMode: 'always',
  indexMode: 'hidden',
  keybindings: [],
};

function isSelectable<Value>(item: Separator | Choice<Value>): item is Choice<Value> {
  return !Separator.isSeparator(item) && !item.disabled;
}

function isEscapeKey(key: KeypressEvent): boolean {
  return key.name === 'escape';
}

function normalizeChoices<Value>(
  choices: ReadonlyArray<string | Separator | Choice<Value>>
): Array<Separator | Choice<Value>> {
  return choices.map((choice) => {
    if (Separator.isSeparator(choice)) return choice;

    if (typeof choice === 'string') {
      return {
        value: choice as Value,
        name: choice,
        short: choice,
        disabled: false,
      };
    }

    const name = choice.name ?? String(choice.value);
    const normalizedChoice: Choice<Value> = {
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

export default createPrompt(
  <Value,>(
    config: {
      message: string;
      choices: readonly (string | Separator | Choice<Value>)[];
      pageSize?: number;
      loop?: boolean;
      default?: unknown;
      instructions?: {
        navigation: string;
        pager: string;
      };
      theme?: PartialDeep<Theme<SelectTheme>>;
    },
    done: (value: Value) => void
  ) => {
    const { loop = true, pageSize = 7 } = config;
    const theme = makeTheme(selectTheme, config.theme);
    const { keybindings } = theme;

    const [status, setStatus] = useState<Status>('idle');
    const prefix = usePrefix({ status, theme });
    const searchTimeoutRef = useRef<NodeJS.Timeout>();

    // Vim keybindings (j/k) conflict with typing those letters in search,
    // so search must be disabled when vim bindings are enabled
    const searchEnabled = !keybindings.includes('vim');

    const items = useMemo(
      () => normalizeChoices(config.choices),
      [config.choices]
    );

    const bounds = useMemo(() => {
      const first = items.findIndex(isSelectable);
      // Find last selectable item (findLastIndex not available in older TS)
      let last = -1;
      for (let i = items.length - 1; i >= 0; i--) {
        if (isSelectable(items[i]!)) {
          last = i;
          break;
        }
      }

      if (first === -1) {
        throw new ValidationError(
          '[select prompt] No selectable choices. All choices are disabled.'
        );
      }

      return { first, last };
    }, [items]);

    const defaultItemIndex = useMemo(() => {
      if (!('default' in config)) return -1;
      return items.findIndex(
        (item) => isSelectable(item) && item.value === config.default
      );
    }, [config.default, items]);

    const [active, setActive] = useState(
      defaultItemIndex === -1 ? bounds.first : defaultItemIndex
    );

    // Safe to assume the cursor position always point to a Choice.
    const selectedChoice = items[active] as Choice<Value>;

    useKeypress((key, rl) => {
      clearTimeout(searchTimeoutRef.current);

      // ESC KEY HANDLING - THIS IS THE NEW ADDITION
      if (isEscapeKey(key)) {
        // Throw ExitPromptError to signal cancellation
        throw new Error('ExitPromptError');
      } else if (isEnterKey(key)) {
        setStatus('done');
        done(selectedChoice.value);
      } else if (isUpKey(key, keybindings) || isDownKey(key, keybindings)) {
        rl.clearLine(0);
        if (
          loop ||
          (isUpKey(key, keybindings) && active !== bounds.first) ||
          (isDownKey(key, keybindings) && active !== bounds.last)
        ) {
          const offset = isUpKey(key, keybindings) ? -1 : 1;
          let next = active;
          do {
            next = (next + offset + items.length) % items.length;
          } while (!isSelectable(items[next]!));
          setActive(next);
        }
      } else if (isNumberKey(key) && !Number.isNaN(Number(rl.line))) {
        const selectedIndex = Number(rl.line) - 1;

        // Find the nth item (ignoring separators)
        let selectableIndex = -1;
        const position = items.findIndex((item) => {
          if (Separator.isSeparator(item)) return false;
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
      } else if (isBackspaceKey(key)) {
        rl.clearLine(0);
      } else if (searchEnabled) {
        const searchTerm = rl.line.toLowerCase();
        const matchIndex = items.findIndex((item) => {
          if (Separator.isSeparator(item) || !isSelectable(item)) return false;
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

    useEffect(
      () => () => {
        clearTimeout(searchTimeoutRef.current);
      },
      []
    );

    const message = theme.style.message(config.message, status);

    let helpLine: string | undefined;
    if (theme.helpMode !== 'never') {
      if (config.instructions) {
        const { pager, navigation } = config.instructions;
        helpLine = theme.style.help(items.length > pageSize ? pager : navigation);
      } else {
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
      renderItem({ item, isActive }: { item: Separator | Choice<Value>; isActive: boolean }) {
        if (Separator.isSeparator(item)) {
          separatorCount++;
          return ` ${item.separator}`;
        }

        const line = item.name || String(item.value);
        if (item.disabled) {
          const disabledLabel =
            typeof item.disabled === 'string' ? item.disabled : '(disabled)';
          return theme.style.disabled(`${line} ${disabledLabel}`);
        }

        const icon = isActive ? theme.icon.cursor : ' ';
        const prefix = theme.indexMode === 'number' ? `${active - separatorCount + 1}. ` : '';
        const color = isActive ? colors.cyan : (x: string) => x;
        const descriptionDisplay = item.description ? `\n  ${theme.style.description(item.description)}` : '';

        return color(`${icon} ${prefix}${line}`) + descriptionDisplay;
      },
      pageSize,
      loop,
    });

    return `${prefix} ${message}${helpLine ? `\n${helpLine}` : ''}\n${page}${cursorHide}`;
  }
);
