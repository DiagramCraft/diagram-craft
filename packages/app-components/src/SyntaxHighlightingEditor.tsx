import React, { useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { extractDataAttributes } from './utils';
import styles from './SyntaxHighlightingEditor.module.css';
import textAreaStyles from './TextArea.module.css';
import { assert } from '@diagram-craft/utils/assert';
import { Browser } from '@diagram-craft/utils/browser';
import { TbArrowsDiagonal } from 'react-icons/tb';
import { Dialog } from './Dialog';

export namespace SyntaxHighlightingEditor {
  export type Ref = {
    setValue: (value: string) => void;
    getValue: () => string;
  };
}

export const SyntaxHighlightingEditor = React.forwardRef<SyntaxHighlightingEditor.Ref, Props>(
  (props, ref) => {
    const [tooltip, setTooltip] = useState<{ x: number; y: number; message: string } | null>(null);
    const [internalValue, setInternalValue] = useState(props.defaultValue ?? '');
    const [maximized, setMaximized] = useState(false);

    const containerRef = useRef<HTMLDivElement>(null);
    const codeElementRef = useRef<HTMLElement>(null);
    const preElementRef = useRef<HTMLPreElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    // Determine if component is controlled or uncontrolled
    const isControlled = props.value !== undefined;
    const value = isControlled ? (props.value ?? '') : internalValue;

    useImperativeHandle(ref, () => ({
      getValue: () => value,
      setValue: value => setInternalValue(value)
    }));

    // Calculate min-height for browsers that don't support attr() in calc()
    useEffect(() => {
      if (!Browser.isChrome() && containerRef.current && textareaRef.current) {
        const rows = props.rows ?? 3;
        const computedStyle = window.getComputedStyle(textareaRef.current);
        const lineHeight = parseFloat(computedStyle.lineHeight);
        const paddingTop = parseFloat(computedStyle.paddingTop);
        const paddingBottom = parseFloat(computedStyle.paddingBottom);
        const minHeight = rows * lineHeight + paddingTop + paddingBottom;
        containerRef.current.style.minHeight = `${minHeight}px`;
      }
    }, [props.rows]);

    const handleChange = useCallback(
      (newValue: string) => {
        if (!isControlled) {
          setInternalValue(newValue);
        }
        props.onChange?.(newValue);
      },
      [isControlled, props]
    );

    const onKeydown = useCallback(
      (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Tab') {
          e.preventDefault();

          const $el = e.target as HTMLTextAreaElement;
          const text = $el.value;

          const before = text.slice(0, $el.selectionStart);
          const after = text.slice($el.selectionEnd, $el.value.length);
          const pos = $el.selectionEnd + 2;
          $el.value = `${before}  ${after}`;
          $el.selectionStart = pos;
          $el.selectionEnd = pos;

          handleChange($el.value);
        }

        props.onKeyDown?.(e);
      },
      [handleChange, props]
    );

    const onScroll = useCallback((source: HTMLElement) => {
      assert.present(preElementRef.current);
      preElementRef.current.scrollTop = source.scrollTop;
      preElementRef.current.scrollLeft = source.scrollLeft;
    }, []);

    const onMouseMove = useCallback(
      (e: React.MouseEvent<HTMLTextAreaElement>) => {
        if (!props.errors || props.errors.size === 0) {
          return;
        }

        const textarea = e.currentTarget;
        const rect = textarea.getBoundingClientRect();
        const computedStyle = window.getComputedStyle(textarea);

        // Read padding and line-height from computed styles
        const paddingTop = parseFloat(computedStyle.paddingTop);
        const lineHeight = parseFloat(computedStyle.lineHeight);

        const scrollTop = textarea.scrollTop;
        const mouseY = e.clientY - rect.top - paddingTop + scrollTop;
        const lineIndex = Math.floor(mouseY / lineHeight);

        // Check if there's an error on this line
        if (lineIndex >= 0 && props.errors.has(lineIndex)) {
          setTooltip({
            x: e.clientX,
            y: e.clientY,
            message: props.errors.get(lineIndex)!
          });
        } else {
          setTooltip(null);
        }

        props.onMouseMove?.(e);
      },
      [props.errors, props]
    );

    const onMouseLeave = useCallback(
      (e: React.MouseEvent<HTMLTextAreaElement>) => {
        setTooltip(null);
        props.onMouseLeave?.(e);
      },
      [props]
    );

    const lines = value.split('\n');
    const highlightedLines = (props.highlighter ? props.highlighter(lines) : lines).map(
      (l, idx) => {
        const error = props.errors?.get(idx);
        return `<span class="${error ? 'syntax-error' : ''}">${l}</span>`;
      }
    );

    const inner = (
      <div
        ref={containerRef}
        className={`${styles.cmpSyntaxHighlightingEditor} ${props.className ?? ''}`}
        {...extractDataAttributes(props)}
        style={props.style ?? {}}
        data-rows={props.rows ?? 10}
      >
        <textarea
          ref={textareaRef}
          spellCheck={false}
          disabled={props.disabled}
          onKeyDown={onKeydown}
          onInput={e => {
            handleChange((e.target as HTMLTextAreaElement).value);
            onScroll(e.target as HTMLElement);
            props.onInput?.(e as React.FormEvent<HTMLTextAreaElement>);
          }}
          onScroll={e => {
            onScroll(e.target as HTMLElement);
            props.onScroll?.(e as React.UIEvent<HTMLTextAreaElement>);
          }}
          onMouseMove={onMouseMove}
          onMouseLeave={onMouseLeave}
          value={value}
        />

        <pre className={styles.syntaxHighlighter} ref={preElementRef}>
          <code
            ref={codeElementRef}
            dangerouslySetInnerHTML={{
              __html: highlightedLines.join('\n')
            }}
          />
        </pre>

        {tooltip && (
          <div
            className={styles.tooltip}
            style={{ left: `${tooltip.x}px`, top: `${tooltip.y + 20}px` }}
          >
            {tooltip.message}
          </div>
        )}

        {!maximized && (
          <button
            onClick={() => setMaximized(true)}
            type={'button'}
            className={textAreaStyles.cmpTextAreaResize}
          >
            <TbArrowsDiagonal />
          </button>
        )}
      </div>
    );

    if (maximized) {
      return (
        <Dialog
          className={textAreaStyles.cmpTextAreaMaxDialog}
          title=""
          open={true}
          buttons={[
            {
              type: 'cancel',
              label: 'Ok',
              onClick: () => setMaximized(false)
            }
          ]}
          onClose={() => setMaximized(false)}
        >
          {inner}
        </Dialog>
      );
    }
    return <div>{inner}</div>;
  }
);

type Props = {
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  highlighter?: (lines: string[]) => string[];
  errors?: Map<number, string>;
  disabled?: boolean;
  className?: string;
  style?: React.CSSProperties;
} & Omit<
  React.DetailedHTMLProps<React.TextareaHTMLAttributes<HTMLTextAreaElement>, HTMLTextAreaElement>,
  'onChange' | 'value' | 'defaultValue'
>;

export const jsonHighlighter = (lines: string[]): string[] => {
  return lines.map(line => {
    // Simple highlighting: keywords in blue, strings in green
    return line
      .replace(/"([^"]*)"/g, '<span class="syntax-string">"$1"</span>')
      .replace(/\}/g, '<span class="syntax-bracket">}</span>')
      .replace(/\{/g, '<span class="syntax-bracket">{</span>')
      .replace(/\]/g, '<span class="syntax-bracket">]</span>')
      .replace(/\[/g, '<span class="syntax-bracket">[</span>');
  });
};
