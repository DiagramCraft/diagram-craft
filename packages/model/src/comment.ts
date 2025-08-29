import { Diagram } from './diagram';
import { DiagramElement } from './diagramElement';
import type { CRDTMap, CRDTRoot } from './collaboration/crdt';
import type { DiagramDocument } from './diagramDocument';
import { assert } from '@diagram-craft/utils/assert';
import { EventEmitter } from '@diagram-craft/utils/event';

type CommentState = 'unresolved' | 'resolved';

export class Comment {
  private _state: CommentState;
  public staleSince: Date | undefined;

  constructor(
    public readonly diagram: Diagram,
    public readonly type: 'element' | 'diagram',
    public readonly id: string,
    public readonly message: string,
    public readonly author: string,
    public readonly date: Date,
    state: CommentState = 'unresolved',
    public readonly element?: DiagramElement,
    public readonly parentId?: string,
    public readonly userColor?: string
  ) {
    this._state = state;
  }

  isStale() {
    return this.type === 'element' &&
      (this.element === undefined || !this.diagram.lookup(this.element.id));
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

  static deserialize(serialized: SerializedComment, document: DiagramDocument): Comment {
    const diagram = document.byId(serialized.diagramId!);
    assert.present(diagram);

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
  commentRemoved: { commentId: string };
};

export class CommentManager extends EventEmitter<CommentManagerEvents> {
  private readonly commentsMap: CRDTMap<Record<string, SerializedComment>>;

  constructor(
    private document: DiagramDocument,
    root: CRDTRoot
  ) {
    super();
    this.commentsMap = root.getMap('comments');
    this.commentsMap.on('remoteDelete', p => {
      this.emit('commentRemoved', { commentId: p.key });
    });
    this.commentsMap.on('remoteInsert', p => {
      this.emit('commentAdded', { comment: this.getComment(p.key)! });
    });
    this.commentsMap.on('remoteUpdate', p => {
      this.emit('commentUpdated', { comment: this.getComment(p.key)! });
    });
  }

  getAllComments(): Comment[] {
    const serializedComments: SerializedComment[] = [];
    for (const comment of this.commentsMap.values()) {
      serializedComments.push(comment);
    }
    return serializedComments
      .map(sc => Comment.deserialize(sc, this.document))
      .filter(c => c !== null) as Comment[];
  }

  getCommentsForDiagram(diagram: Diagram): Comment[] {
    return this.getAllComments().filter(
      comment => comment.type === 'diagram' && comment.diagram?.id === diagram.id && !comment.isStale()
    );
  }

  getCommentsForElement(element: DiagramElement): Comment[] {
    return this.getAllComments().filter(
      comment => comment.type === 'element' && comment.element?.id === element.id && !comment.isStale()
    );
  }

  getAllCommentsForDiagram(diagram: Diagram): Comment[] {
    return this.getAllComments().filter(
      comment => comment.diagram?.id === diagram.id && !comment.isStale()
    );
  }

  addComment(comment: Comment): void {
    const serialized = comment.serialize();
    this.commentsMap.set(comment.id, serialized);
    this.emit('commentAdded', { comment });
  }

  updateComment(comment: Comment): void {
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
    if (this.commentsMap.has(commentId)) {
      // First, recursively delete all replies
      const repliesToDelete = this.getReplies({ id: commentId } as Comment);
      for (const reply of repliesToDelete) {
        this.removeComment(reply.id);
      }
      
      // Then delete the comment itself
      this.commentsMap.delete(commentId);
      this.emit('commentRemoved', { commentId });
    }
  }

  getComment(commentId: string): Comment | undefined {
    const serialized = this.commentsMap.get(commentId);
    if (!serialized) return undefined;
    return Comment.deserialize(serialized, this.document);
  }

  getReplies(comment: Comment): Comment[] {
    return this.getAllComments().filter(c => c.parentId === comment.id);
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
