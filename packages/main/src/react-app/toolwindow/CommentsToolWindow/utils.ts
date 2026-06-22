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

export const groupThreadsByElement = (threads: CommentThread[]): Array<Group> => {
  const groups = new MultiMap<string, CommentThread>();

  for (const thread of threads) {
    const key = thread.root.type === 'diagram' ? 'diagram' : getElementNameFromComment(thread.root);
    groups.add(key, thread);
  }

  return Array.from(groups.entries()).map(([key, threads]) => ({
    key,
    title: threads[0] ? getElementNameFromComment(threads[0].root) : 'Unknown',
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

export const getElementNameFromComment = (comment: Comment) => {
  if (comment.type === 'diagram') return 'Diagram';
  if (comment.element) return comment.element.name;
  return 'Unknown Element';
};

export const buildCommentThreads = (allComments: Comment[]): CommentThread[] => {
  const commentMap = new Map<string, Comment>();
  for (const comment of allComments) {
    commentMap.set(comment.id, comment);
  }

  return allComments
    .filter(c => !c.isReply())
    .map(root => ({ root, replies: collectReplies(root.id, commentMap) }));
};

const collectReplies = (rootId: string, commentMap: Map<string, Comment>): Comment[] => {
  const result: Comment[] = [];
  const queue = [rootId];

  while (queue.length > 0) {
    const parentId = queue.shift()!;
    for (const comment of commentMap.values()) {
      if (comment.parentId === parentId) {
        result.push(comment);
        queue.push(comment.id);
      }
    }
  }

  return result.sort((a, b) => a.date.getTime() - b.date.getTime());
};

export const filterThreadsByUserParticipation = (
  threads: CommentThread[],
  userName: string
): CommentThread[] =>
  threads.filter(
    t => t.root.author === userName || t.replies.some(r => r.author === userName)
  );
