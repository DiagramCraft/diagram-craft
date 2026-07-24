/**
 * How inline wiki comments are surfaced on a page:
 * - `side`: highlights in the text, full comment cards in a right-margin rail (default).
 * - `inline`: highlights in the text only; clicking one pops up its thread.
 * - `off`: no highlights, no comment UI at all.
 */
export type CommentsDisplayMode = 'side' | 'inline' | 'off';

const CYCLE: readonly CommentsDisplayMode[] = ['side', 'inline', 'off'];

export const nextCommentsDisplayMode = (mode: CommentsDisplayMode): CommentsDisplayMode =>
  CYCLE[(CYCLE.indexOf(mode) + 1) % CYCLE.length]!;
