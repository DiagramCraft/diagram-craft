import { Comment } from '@diagram-craft/model/comment';
import { MultiMap } from '@diagram-craft/utils/multimap';

export type SortBy = 'date-asc' | 'date-desc';
export type GroupBy = 'none' | 'element' | 'author';

export type CommentThread = {
  root: Comment;
  replies: Comment[];
};

type Group = {
  key: string;
  title: string;
  threads: CommentThread[];
};

export const groupThreadsByElement = (
  threads: CommentThread[],
  getElementName: (comment: Comment) => string
): Array<Group> => {
  const groups = new MultiMap<string, CommentThread>();

  for (const thread of threads) {
    groups.add(thread.root.type, thread);
  }

  return Array.from(groups.entries()).map(([key, threads]) => ({
    key,
    title: threads[0] ? getElementName(threads[0].root) : 'Unknown',
    threads
  }));
};

export const groupThreadsByAuthor = (threads: CommentThread[]): Array<Group> => {
  const groups = new MultiMap<string, CommentThread>();

  for (const thread of threads) {
    groups.add(thread.root.author, thread);
  }

  return Array.from(groups.entries()).map(([author, threads]) => ({
    key: author,
    title: author,
    threads
  }));
};
