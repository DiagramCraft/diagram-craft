// Minimal POSIX path implementation (enough for the server code that runs in the demo Worker)
export const sep = '/';

const normalizeParts = (parts: string[], absolute: boolean) => {
  const out: string[] = [];
  for (const p of parts) {
    if (!p || p === '.') continue;
    if (p === '..') {
      if (out.length > 0 && out[out.length - 1] !== '..') out.pop();
      else if (!absolute) out.push('..');
    } else out.push(p);
  }
  return out;
};

export const join = (...segments: string[]): string => {
  const joined = segments.filter(Boolean).join('/');
  const absolute = joined.startsWith('/');
  const result = normalizeParts(joined.split('/'), absolute).join('/');
  return absolute ? `/${result}` : result || '.';
};

export const resolve = (...segments: string[]): string => {
  let acc = '';
  for (const s of segments) acc = s.startsWith('/') ? s : acc ? `${acc}/${s}` : s;
  return `/${normalizeParts(acc.split('/'), true).join('/')}`;
};

export const dirname = (p: string): string => {
  const i = p.replace(/\/+$/, '').lastIndexOf('/');
  return i < 0 ? '.' : i === 0 ? '/' : p.slice(0, i);
};

export const basename = (p: string, ext?: string): string => {
  const base = p.replace(/\/+$/, '').split('/').pop() ?? '';
  return ext && base.endsWith(ext) ? base.slice(0, -ext.length) : base;
};

export const relative = (from: string, to: string): string => {
  const f = resolve(from).split('/').filter(Boolean);
  const t = resolve(to).split('/').filter(Boolean);
  while (f.length && t.length && f[0] === t[0]) {
    f.shift();
    t.shift();
  }
  return [...f.map(() => '..'), ...t].join('/');
};

export default { sep, join, resolve, dirname, basename, relative };
