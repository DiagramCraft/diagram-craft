import type { MatchResult } from './types';

/**
 * A line-based token stream for parsing markdown text.
 * Splits text into lines and provides methods to peek and consume lines.
 */
export class TokenStream {
  private lines: string[];
  private ptr = 0;

  /**
   * Creates a new TokenStream from the given text.
   * @param s - The text to split into lines
   */
  constructor(s: string) {
    this.lines = s.split(/[\n\r]/);
  }

  /**
   * Peeks at a line without consuming it.
   * @param i - Line offset from current position (0 = current line)
   * @returns MatchResult object with line text and utility methods
   */
  peek(i = 0): MatchResult {
    const idx = this.ptr + i;
    const text = (idx > this.lines.length || idx < 0) ? null : this.lines[idx];

    return {
      text,
      match: (re: RegExp) => text?.match(re) ?? null,
      isEmpty: () => text === null || /^\s*$/.test(text),
      isEOS: () => text === null
    };
  }

  /**
   * Checks if the stream has reached the end.
   * @returns True if at end of stream
   */
  isEOS(): boolean {
    return this.ptr > this.lines.length;
  }

  /**
   * Consumes and returns a line, advancing the stream position.
   * @param i - Line offset to consume relative to current position
   * @returns MatchResult for the consumed line
   */
  consume(i = 0): MatchResult {
    const result = this.peek(i);
    this.ptr += 1 + i;
    return result;
  }

  /**
   * Returns the current line number (0-based).
   * @returns Current line number
   */
  line(): number {
    return this.ptr;
  }
}