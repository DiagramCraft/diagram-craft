import { Browser } from '@diagram-craft/canvas/browser';
import { ELEMENTS_CONTENT_TYPE } from './clipboardConstants';

type ClipboardItem = {
  type: string;
  blob: Promise<Blob>;
};

type ClipboardWriteMode = 'copy' | 'cut';

type Clipboard = {
  read: () => Promise<ClipboardItem[]>;
  write: (content: string, contentType: string, mode: ClipboardWriteMode) => Promise<void>;
};

const PREFIX = `${ELEMENTS_CONTENT_TYPE};`;

/**
 * Note: There is special handling of application/x-diagram-craft-selection here,
 * as it's not possible to write arbitrary content types to the clipboard.
 * Instead, we write it using text/plain with a prefix in the content
 */
const HTML5Clipboard: Clipboard = {
  read: async (): Promise<ClipboardItem[]> => {
    const clip = await navigator.clipboard.read();
    const dest: ClipboardItem[] = [];

    for (const c of clip) {
      const types = c.types;

      for (const type of types) {
        if (type === 'text/plain') {
          const blob = await c.getType(type);
          const text = await blob.text();
          if (text.startsWith(PREFIX)) {
            dest.push({
              type: ELEMENTS_CONTENT_TYPE,
              blob: Promise.resolve(
                new Blob([text.slice(PREFIX.length)], { type: ELEMENTS_CONTENT_TYPE })
              )
            });
            continue;
          }
        }
        dest.push({ type, blob: c.getType(type) });
      }
    }

    return dest;
  },
  write: async (content: string, contentType: string, _mode: ClipboardWriteMode) => {
    if (contentType === ELEMENTS_CONTENT_TYPE) {
      await navigator.clipboard.write([
        new ClipboardItem({
          ['text/plain']: new Blob([PREFIX + content], { type: 'text/plain' })
        })
      ]);
    } else {
      await navigator.clipboard.write([
        new ClipboardItem({
          [contentType]: new Blob([content], { type: contentType })
        })
      ]);
    }
  }
};

/**
 * The idea here is to use a hidden textarea as the source and target of clipboard operations.
 * As such, it is limited to text payloads. Similar to the HTML5Clipboard, special handling
 * is required for application/x-diagram-craft-selection - similar to HTML5Clipboard, the
 * content is prefixed to allow for discrimination on paste
 */
declare global {
  interface HTMLElement {
    _diagramCraftClipboard?: string;
  }
}

const TextareaClipboard: Clipboard = {
  read: async (): Promise<ClipboardItem[]> => {
    const $clipboard = document.getElementById('clipboard')! as HTMLTextAreaElement;
    $clipboard.value = '';
    $clipboard.focus();

    document.execCommand('paste');

    return new Promise<ClipboardItem[]>(resolve => {
      window.setTimeout(() => {
        let content = $clipboard.value;

        if (content.trim() === '') {
          content = document.body._diagramCraftClipboard ?? '';
        }

        if (content.startsWith(PREFIX)) {
          resolve([
            {
              type: ELEMENTS_CONTENT_TYPE,
              blob: Promise.resolve(
                new Blob([content.slice(PREFIX.length)], { type: ELEMENTS_CONTENT_TYPE })
              )
            }
          ]);
        } else {
          resolve([
            {
              type: 'text/plain',
              blob: Promise.resolve(new Blob([content], { type: 'text/plain' }))
            }
          ]);
        }
      }, 10);
    });
  },
  write: async (content: string, contentType: string, mode: ClipboardWriteMode) => {
    const $clipboard: HTMLTextAreaElement = document.getElementById(
      'clipboard'
    )! as HTMLTextAreaElement;
    if (contentType === ELEMENTS_CONTENT_TYPE) {
      $clipboard.value = PREFIX + content;
    } else {
      $clipboard.value = content;
    }
    $clipboard.focus();
    $clipboard.select();

    document.execCommand(mode);

    document.body._diagramCraftClipboard = $clipboard.value;
  }
};

/** @namespace */
export const Clipboard = {
  get(): Clipboard {
    if (Browser.isFirefox()) {
      return TextareaClipboard;
    } else {
      return HTML5Clipboard;
    }
  }
};
