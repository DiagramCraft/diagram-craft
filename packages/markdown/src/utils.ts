export const Util = {
  iterateRegex(re: RegExp, s: string, fn: (match: RegExpExecArray | string) => number | void): void {
    let res: RegExpExecArray | null;
    let lastIndex = 0;

    while ((res = re.exec(s)) !== null) {
      if (res.index > lastIndex) {
        fn(s.substring(lastIndex, res.index));
      }

      const fnResult = fn(res);
      lastIndex = re.lastIndex + ((fnResult ?? res[0].length) - res[0].length);
    }

    if (lastIndex > 0) {
      if (lastIndex < s.length) {
        fn(s.substring(lastIndex));
      }
    } else {
      fn(s);
    }
  },

  findBalancedSubstring(s: string, start: string, end: string): string | null {
    if (s[0] !== start || s.length === 0) return null;

    let depth = 1;
    for (let i = 1; i < s.length; i++) {
      if (s[i] === start) depth++;
      if (s[i] === end) depth--;

      if (depth === 0) {
        return s.substring(0, i + 1);
      }
    }

    return null;
  }
};