import type { ReactNode } from 'react';

export const Hi = ({ s, q }: { s: string; q: string }) => {
  if (!q) return <>{s}</>;
  const text = String(s ?? '');
  const needle = q.toLowerCase();
  const lower = text.toLowerCase();
  const parts: ReactNode[] = [];
  let cur = 0;
  let idx = lower.indexOf(needle, 0);
  while (idx >= 0) {
    if (idx > cur) parts.push(<span key={`t${cur}`}>{text.slice(cur, idx)}</span>);
    parts.push(<mark key={`m${idx}`}>{text.slice(idx, idx + needle.length)}</mark>);
    cur = idx + needle.length;
    idx = lower.indexOf(needle, cur);
  }
  if (cur < text.length) parts.push(<span key="tail">{text.slice(cur)}</span>);
  return parts.length ? parts : text;
};
