import { Comment } from '@diagram-craft/model/comment';
import { MultiMap } from '@diagram-craft/utils/multimap';

export type SortBy = 'date-asc' | 'date-desc';
export type GroupBy = 'none' | 'element' | 'author';

export type CommentThread = {
  root: Comment;
  replies: CommentThreadNode[];
};

export type CommentThreadNode = {
  comment: Comment;
  level: number;
  replies: CommentThreadNode[];
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
  const threads: CommentThread[] = [];

  // Create a map of all comments for easy lookup
  for (const comment of allComments) {
    commentMap.set(comment.id, comment);
  }

  // Find root comments (comments without parents)
  const rootComments = allComments.filter(c => !c.isReply());

  for (const rootComment of rootComments) {
    const thread: CommentThread = {
      root: rootComment,
      replies: buildNestedReplies(rootComment.id, commentMap, 1, 3) // Start at level 1, max 3 levels
    };
    threads.push(thread);
  }

  return threads;
};

const buildNestedReplies = (
  parentId: string, 
  commentMap: Map<string, Comment>, 
  currentLevel: number,
  maxLevel: number
): CommentThreadNode[] => {
  if (currentLevel > maxLevel) return [];

  const replies: CommentThreadNode[] = [];
  
  for (const [, comment] of commentMap) {
    if (comment.parentId === parentId) {
      const node: CommentThreadNode = {
        comment,
        level: currentLevel,
        replies: buildNestedReplies(comment.id, commentMap, currentLevel + 1, maxLevel)
      };
      replies.push(node);
    }
  }

  // Sort replies by date
  replies.sort((a, b) => a.comment.date.getTime() - b.comment.date.getTime());
  
  return replies;
};
