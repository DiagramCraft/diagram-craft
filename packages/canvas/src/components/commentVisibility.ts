export type CommentVisibility = 'all' | 'unresolved' | 'none';

export const isCommentVisible = (
  visibility: CommentVisibility | undefined,
  state: 'unresolved' | 'resolved'
) => {
  const mode = visibility ?? 'all';
  return mode !== 'none' && (mode === 'all' || state === 'unresolved');
};
