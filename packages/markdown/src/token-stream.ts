import type { MatchResult } from './types';

export class TokenStream {
  private lines: string[];
  private ptr = 0;

  constructor(s: string) {
    this.lines = s.split(/[\n\r]/);
  }

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

  isEOS(): boolean {
    return this.ptr > this.lines.length;
  }

  consume(i = 0): MatchResult {
    const result = this.peek(i);
    this.ptr += 1 + i;
    return result;
  }

  line(): number {
    return this.ptr;
  }
}