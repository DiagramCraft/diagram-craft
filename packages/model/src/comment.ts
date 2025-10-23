import type { Diagram } from './diagram';
import { DiagramElement } from './diagramElement';
import type { CRDTMap } from './collaboration/crdt';
import { EventEmitter } from '@diagram-craft/utils/event';
import { assert, precondition } from '@diagram-craft/utils/assert';

export type CommentState = 'unresolved' | 'resolved';

/**
 * Represents a comment attached to either a diagram or a specific element.
 * Comments can be part of a thread via parentId and can become stale if their element is deleted.
 */
export class Comment {
  /** Timestamp when the comment became stale (element was deleted) */
  public staleSince: Date | undefined;

  #state: CommentState;
  #message: string;

  constructor(
    public readonly diagram: Diagram,
    public readonly type: 'element' | 'diagram',
    public readonly id: string,
    message: string,
    public readonly author: string,
    public readonly date: Date,
    state: CommentState = 'unresolved',
    public readonly element?: DiagramElement,
    public readonly parentId?: string,
    public readonly userColor?: string
  ) {
    this.#state = state;
    this.#message = message;
  }

  get message() {
    return this.#message;
  }

  /** Updates the comment message */
  edit(message: string) {
    this.#message = message;
  }

  /** Checks if comment is stale (attached element no longer exists in diagram) */
  isStale() {
    if (this.type !== 'element') return false;
    return this.element === undefined || !this.diagram.lookup(this.element.id);
  }

  get state() {
    return this.#state;
  }

  /** Marks the comment as resolved */
  resolve() {
    this.#state = 'resolved';
  }

  /** Marks the comment as unresolved */
  unresolve() {
    this.#state = 'unresolved';
  }

  /** Checks if this comment is a reply to another comment */
  isReply() {
    return this.parentId !== undefined;
  }

  /** Converts the comment to a plain object for storage or transmission */
  serialize(): SerializedComment {
    return {
      id: this.id,
      date: this.date.toISOString(),
      author: this.author,
      message: this.message,
      state: this.state,
      parentId: this.parentId,
      type: this.type,
      diagramId: this.diagram.id,
      elementId: this.element?.id,
      userColor: this.userColor
    };
  }

  /** Creates a Comment instance from a serialized representation */
  static deserialize(serialized: SerializedComment, diagram: Diagram): Comment {
    precondition.is.present(serialized.id);
    precondition.is.present(serialized.message);
    precondition.is.present(serialized.author);
    precondition.is.present(serialized.date);
    precondition.is.present(serialized.type);
    precondition.is.present(serialized.state);
    precondition.is.true(serialized.diagramId === diagram.id);

    const date = new Date(serialized.date);
    assert.false(Number.isNaN(date.getTime()));

    const element =
      serialized.type === 'element' ? diagram.lookup(serialized.elementId!) : undefined;

    return new Comment(
      diagram,
      serialized.type,
      serialized.id,
      serialized.message,
      serialized.author,
      date,
      serialized.state,
      element,
      serialized.parentId,
      serialized.userColor
    );
  }
}

/** Plain object representation of a comment for serialization */
export type SerializedComment = {
  id: string;
  date: string;
  author: string;
  message: string;
  state: CommentState;
  parentId?: string;
  type: 'diagram' | 'element';
  diagramId: string;
  elementId?: string;
  userColor?: string;
};

type CommentManagerEvents = {
  commentAdded: { comment: Comment };
  commentUpdated: { comment: Comment };
  commentRemoved: { comment: SerializedComment };
};

/**
 * Manages comments for a diagram using CRDT-based storage for collaboration support.
 * Handles comment threads, staleness detection, and emits events for remote changes.
 */
export class CommentManager extends EventEmitter<CommentManagerEvents> {
  constructor(
    private diagram: Diagram,
    private commentsMap: CRDTMap<Record<string, SerializedComment>>
  ) {
    super();
    // Forward CRDT remote events as local events for UI to react to
    this.commentsMap.on('remoteDelete', p => {
      this.emit('commentRemoved', { comment: p.value });
    });
    this.commentsMap.on('remoteInsert', p => {
      const comment = this.getComment(p.key)!;
      this.emit('commentAdded', { comment: comment });
    });
    this.commentsMap.on('remoteUpdate', p => {
      const comment = this.getComment(p.key)!;
      this.emit('commentUpdated', { comment: comment });
    });
  }

  /** Returns all comments including stale and resolved ones */
  getAll(): Comment[] {
    return Array.from(this.commentsMap.values()).map(sc => Comment.deserialize(sc, this.diagram));
  }

  /** Returns only diagram-level comments that are not stale */
  getDiagramComments(): Comment[] {
    const result: Comment[] = [];
    for (const serialized of this.commentsMap.values()) {
      if (serialized.type !== 'diagram') continue;

      const comment = Comment.deserialize(serialized, this.diagram);
      if (!comment.isStale()) result.push(comment);
    }
    return result;
  }

  /** Adds a new comment and emits commentAdded event */
  addComment(comment: Comment): void {
    precondition.is.true(comment.diagram === this.diagram);

    const serialized = comment.serialize();
    this.commentsMap.set(comment.id, serialized);

    this.emit('commentAdded', { comment });
  }

  /** Updates an existing comment and emits commentUpdated event */
  updateComment(comment: Comment): void {
    precondition.is.true(comment.diagram === this.diagram);

    if (this.commentsMap.has(comment.id)) {
      const serialized = comment.serialize();
      this.commentsMap.set(comment.id, serialized);

      this.emit('commentUpdated', { comment });
    }
  }

  /** Adds a reply to an existing comment */
  replyToComment(replyTo: Comment, reply: Comment): void {
    if (reply.parentId !== replyTo.id) {
      throw new Error('Reply comment must have parentId matching the comment being replied to');
    }
    this.addComment(reply);
  }

  /** Removes a comment and all its replies recursively */
  removeComment(commentId: string): void {
    const comment = this.getComment(commentId);
    assert.present(comment);
    precondition.is.true(comment.diagram === this.diagram);

    // First, recursively delete all replies
    const repliesToDelete = this.getReplies(commentId);
    for (const reply of repliesToDelete) {
      this.removeComment(reply.id);
    }

    // Then delete the comment itself
    this.commentsMap.delete(commentId);

    this.emit('commentRemoved', { comment: comment.serialize() });
  }

  /** Retrieves a comment by ID */
  getComment(commentId: string): Comment | undefined {
    const serialized = this.commentsMap.get(commentId);
    if (!serialized) return undefined;
    return Comment.deserialize(serialized, this.diagram);
  }

  /** Returns all direct replies to a comment */
  getReplies(comment: Comment | string): Comment[] {
    const parentId = typeof comment === 'string' ? comment : comment.id;
    const result: Comment[] = [];
    for (const serialized of this.commentsMap.values()) {
      if (serialized.parentId !== parentId) continue;

      result.push(Comment.deserialize(serialized, this.diagram));
    }
    return result;
  }

  /** Returns the complete thread containing this comment (root + all nested replies) */
  getCommentThread(comment: Comment): Comment[] {
    const thread: Comment[] = [];

    // Walk up to find the root comment (comment with no parent)
    let current = comment;
    while (current.parentId) {
      const parent = this.getComment(current.parentId);
      if (!parent) break;
      current = parent;
    }

    // Recursively build the thread starting from root
    const addToThread = (c: Comment) => {
      thread.push(c);
      const replies = this.getReplies(c);
      replies.forEach(addToThread);
    };

    addToThread(current);
    return thread;
  }
}
