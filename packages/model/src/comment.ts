import type { Diagram } from './diagram';
import { DiagramElement } from './diagramElement';
import type { CRDTMap } from './collaboration/crdt';
import { EventEmitter } from '@diagram-craft/utils/event';
import { assert, precondition } from '@diagram-craft/utils/assert';

export type CommentState = 'unresolved' | 'resolved';

export class Comment {
  private _state: CommentState;
  public staleSince: Date | undefined;
  private _message: string;

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
    this._state = state;
    this._message = message;
  }

  get message(): string {
    return this._message;
  }

  edit(message: string) {
    this._message = message;
  }

  isStale() {
    return (
      this.type === 'element' &&
      (this.element === undefined || !this.diagram.lookup(this.element.id))
    );
  }

  get state(): CommentState {
    return this._state;
  }

  resolve(): void {
    this._state = 'resolved';
  }

  unresolve(): void {
    this._state = 'unresolved';
  }

  isReply(): boolean {
    return this.parentId !== undefined;
  }

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

  static deserialize(serialized: SerializedComment, diagram: Diagram): Comment {
    const element =
      serialized.type === 'element' ? diagram.lookup(serialized.elementId!) : undefined;

    return new Comment(
      diagram,
      serialized.type,
      serialized.id,
      serialized.message,
      serialized.author,
      new Date(serialized.date),
      serialized.state,
      element,
      serialized.parentId,
      serialized.userColor
    );
  }
}

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

export type CommentManagerEvents = {
  commentAdded: { comment: Comment };
  commentUpdated: { comment: Comment };
  commentRemoved: { comment: SerializedComment };
};

export class CommentManager extends EventEmitter<CommentManagerEvents> {
  constructor(
    private diagram: Diagram,
    private commentsMap: CRDTMap<Record<string, SerializedComment>>
  ) {
    super();
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

  getAll(): Comment[] {
    const serializedComments: SerializedComment[] = [];
    for (const comment of this.commentsMap.values()) {
      serializedComments.push(comment);
    }
    return serializedComments.map(sc => Comment.deserialize(sc, this.diagram));
  }

  getDiagramComments(): Comment[] {
    return this.getAll().filter(comment => comment.type === 'diagram' && !comment.isStale());
  }

  addComment(comment: Comment): void {
    precondition.is.true(comment.diagram === this.diagram);

    const serialized = comment.serialize();
    this.commentsMap.set(comment.id, serialized);

    this.emit('commentAdded', { comment });
  }

  updateComment(comment: Comment): void {
    precondition.is.true(comment.diagram === this.diagram);

    if (this.commentsMap.has(comment.id)) {
      const serialized = comment.serialize();
      this.commentsMap.set(comment.id, serialized);

      this.emit('commentUpdated', { comment });
    }
  }

  replyToComment(replyTo: Comment, reply: Comment): void {
    if (reply.parentId !== replyTo.id) {
      throw new Error('Reply comment must have parentId matching the comment being replied to');
    }
    this.addComment(reply);
  }

  removeComment(commentId: string): void {
    const comment = this.getComment(commentId);
    assert.present(comment);
    precondition.is.true(comment?.diagram === this.diagram);

    // First, recursively delete all replies
    const repliesToDelete = this.getReplies({ id: commentId } as Comment);
    for (const reply of repliesToDelete) {
      this.removeComment(reply.id);
    }

    // Then delete the comment itself
    this.commentsMap.delete(commentId);

    this.emit('commentRemoved', { comment: comment.serialize() });
  }

  getComment(commentId: string): Comment | undefined {
    const serialized = this.commentsMap.get(commentId);
    if (!serialized) return undefined;
    return Comment.deserialize(serialized, this.diagram);
  }

  getReplies(comment: Comment): Comment[] {
    return this.getAll().filter(c => c.parentId === comment.id);
  }

  getCommentThread(comment: Comment): Comment[] {
    const thread: Comment[] = [];

    // Find root comment
    let current = comment;
    while (current.parentId) {
      const parent = this.getComment(current.parentId);
      if (!parent) break;
      current = parent;
    }

    // Build thread starting from root
    const addToThread = (c: Comment) => {
      thread.push(c);
      const replies = this.getReplies(c);
      replies.forEach(addToThread);
    };

    addToThread(current);
    return thread;
  }
}
