/**
 * Comment system for collaborative diagram annotations and discussions.
 *
 * This module provides a complete commenting system for diagrams, supporting threaded
 * discussions and element-specific comments. Comments can be attached to the entire diagram
 * or to specific diagram elements, with automatic staleness detection when elements are deleted.
 *
 * @module comment
 *
 * @remarks
 * ## Key Concepts
 *
 * **Comment Types**: Comments can be attached at two levels:
 * - `diagram`: General comments about the entire diagram
 * - `element`: Comments attached to specific nodes or edges
 *
 * **Threading**: Comments support nested reply threads. Each comment can have a
 * `parentId` linking it to another comment, enabling multi-level discussions.
 *
 * **Comment States**: Comments can be marked as 'resolved' or 'unresolved', allowing
 * teams to track which discussions are still active and which have been addressed.
 *
 * **Staleness Detection**: Element comments automatically become "stale" when their
 * target element is deleted from the diagram. Stale comments remain accessible but
 * are flagged to indicate their referenced element no longer exists.
 *
 * ## Architecture
 *
 * The module consists of three main components:
 *
 * 1. **{@link Comment}**: Represents an individual comment with its metadata (author,
 *    date, message, state). Includes methods for editing, resolving, and serialization.
 *
 * 2. **{@link CommentManager}**: Central manager for all comments in a diagram. Handles
 *    adding, updating, removing comments, managing threads, and emitting events for
 *    real-time updates.
 *
 * 3. **{@link SerializedComment}**: Plain object representation for storage and
 *    transmission, used internally for CRDT synchronization.
 *
 * ## Threading Model
 *
 * Comments form tree structures through parent-child relationships:
 * - Root comments have no `parentId`
 * - Reply comments have a `parentId` pointing to their parent
 * - Entire threads can be retrieved with {@link CommentManager.getCommentThread}
 * - Deleting a comment recursively deletes all its replies
 *
 * ## Event System
 *
 * The comment manager emits events for comment changes:
 * - `commentAdded`: When a new comment is created (local or remote)
 * - `commentUpdated`: When a comment is modified (local or remote)
 * - `commentRemoved`: When a comment is deleted (local or remote)
 *
 * These events enable UI components to stay synchronized with comment changes from
 * other collaborators in real-time.
 *
 * @example
 * ```typescript
 * // Add a diagram-level comment
 * const comment = new Comment(
 *   diagram,
 *   'diagram',
 *   generateId(),
 *   'This diagram needs revision',
 *   'alice@example.com',
 *   new Date(),
 *   'unresolved'
 * );
 * commentManager.addComment(comment);
 *
 * // Add an element-specific comment
 * const elementComment = new Comment(
 *   diagram,
 *   'element',
 *   generateId(),
 *   'This node should be renamed',
 *   'bob@example.com',
 *   new Date(),
 *   'unresolved',
 *   element  // Reference to the diagram element
 * );
 * commentManager.addComment(elementComment);
 *
 * // Reply to a comment
 * const reply = new Comment(
 *   diagram,
 *   'diagram',
 *   generateId(),
 *   'I agree, will update soon',
 *   'charlie@example.com',
 *   new Date(),
 *   'unresolved',
 *   undefined,
 *   comment.id  // parentId
 * );
 * commentManager.replyToComment(comment, reply);
 *
 * // Resolve a comment
 * comment.resolve();
 * commentManager.updateComment(comment);
 *
 * // Get entire thread
 * const thread = commentManager.getCommentThread(reply);
 * console.log(`Thread has ${thread.length} comments`);
 *
 * // Listen for remote changes
 * commentManager.on('commentAdded', ({ comment }) => {
 *   console.log(`New comment from ${comment.author}: ${comment.message}`);
 * });
 * ```
 *
 * @see {@link Comment} - Individual comment representation
 * @see {@link CommentManager} - Comment management and threading
 * @see {@link CommentState} - Comment resolution state
 */

import type { Diagram } from './diagram';
import { DiagramElement } from './diagramElement';
import { EventEmitter } from '@diagram-craft/utils/event';
import { assert, precondition } from '@diagram-craft/utils/assert';
import type { CRDTMap } from '@diagram-craft/collaboration/crdt';
import { type Releasable, Releasables } from '@diagram-craft/utils/releasable';

/**
 * Represents the resolution state of a comment.
 *
 * @remarks
 * Comments start as 'unresolved' by default and can be marked as 'resolved' when
 * the discussion is complete or the issue has been addressed. Resolved comments
 * can be unresolved if the discussion needs to be reopened.
 */
export type CommentState = 'unresolved' | 'resolved';

/**
 * Represents a comment in a diagram discussion.
 *
 * Comments can be attached to the entire diagram or to specific diagram elements
 * (nodes, edges). They support threading through parent-child relationships and
 * can be marked as resolved or unresolved. Element comments automatically detect
 * when their target element is deleted and become "stale".
 *
 * For element comments, the `element` reference may become undefined if the
 * element is deleted from the diagram. Use {@link isStale} to check if an
 * element comment's target still exists.
 *
 * @example
 * ```typescript
 * // Create a diagram-level comment
 * const comment = new Comment(
 *   diagram,
 *   'diagram',
 *   'comment-1',
 *   'We should add more documentation',
 *   'alice@example.com',
 *   new Date(),
 *   'unresolved'
 * );
 *
 * // Create an element comment
 * const nodeComment = new Comment(
 *   diagram,
 *   'element',
 *   'comment-2',
 *   'This node color should be blue',
 *   'bob@example.com',
 *   new Date(),
 *   'unresolved',
 *   targetNode
 * );
 *
 * // Create a reply
 * const reply = new Comment(
 *   diagram,
 *   'diagram',
 *   'comment-3',
 *   'Good idea!',
 *   'charlie@example.com',
 *   new Date(),
 *   'unresolved',
 *   undefined,
 *   comment.id  // parentId links to parent comment
 * );
 * ```
 */
export class Comment {
  /**
   * Timestamp when the comment became stale due to its element being deleted.
   *
   * @remarks
   * This field is undefined for non-stale comments and diagram-level comments.
   * It's automatically set by external logic when an element comment's target
   * element is removed from the diagram.
   */
  public staleSince: Date | undefined;

  #state: CommentState;
  #message: string;

  /**
   * Creates a new comment instance.
   *
   * @param diagram - The diagram this comment belongs to
   * @param type - Whether this is a 'diagram' or 'element' level comment
   * @param id - Unique identifier for this comment
   * @param message - The comment text content
   * @param author - Identifier for the comment author (e.g., email, username)
   * @param date - Timestamp when the comment was created
   * @param state - Resolution state (default: 'unresolved')
   * @param element - The diagram element this comment is attached to (for element comments)
   * @param parentId - ID of the parent comment if this is a reply
   * @param userColor - Optional color associated with the author for UI display
   *
   * @remarks
   * For element comments, the `element` parameter must be provided. The element
   * reference is maintained but may become stale if the element is deleted.
   *
   * For reply comments, `parentId` must reference an existing comment in the same
   * diagram. The parent can be verified using {@link CommentManager.getComment}.
   */
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

  /**
   * Gets the comment message text.
   *
   * @returns The current message content
   */
  get message() {
    return this.#message;
  }

  /**
   * Updates the comment message text.
   *
   * @param message - The new message content
   *
   * @remarks
   * After editing, call {@link CommentManager.updateComment} to persist the
   * change and notify other collaborators.
   *
   * @example
   * ```typescript
   * comment.edit('Updated message with more details');
   * commentManager.updateComment(comment);
   * ```
   */
  edit(message: string) {
    this.#message = message;
  }

  /**
   * Checks if this comment is stale (its referenced element no longer exists).
   *
   * @returns True if this is an element comment and its element has been deleted,
   *   false otherwise
   *
   * @remarks
   * Diagram-level comments are never stale. Element comments become stale when:
   * - The `element` reference is undefined, OR
   * - The element ID cannot be found in the diagram
   *
   * Stale comments remain accessible but their element reference is no longer valid.
   * The UI typically displays stale comments differently to indicate their status.
   */
  isStale() {
    if (this.type !== 'element') return false;
    return this.element === undefined || !this.diagram.lookup(this.element.id);
  }

  /**
   * Gets the current resolution state of the comment.
   *
   * @returns The comment state ('unresolved' or 'resolved')
   */
  get state() {
    return this.#state;
  }

  /**
   * Marks the comment as resolved.
   *
   * @remarks
   * Resolving a comment indicates the discussion is complete or the issue has
   * been addressed. After resolving, call {@link CommentManager.updateComment}
   * to persist the change.
   *
   * Resolved comments can be unresolve later if needed.
   *
   * @example
   * ```typescript
   * comment.resolve();
   * commentManager.updateComment(comment);
   * ```
   */
  resolve() {
    this.#state = 'resolved';
  }

  /**
   * Marks the comment as unresolved.
   *
   * @remarks
   * Unresolving reopens a previously resolved comment. This is useful when a
   * discussion needs to be continued or an issue resurfaces. After unresolving,
   * call {@link CommentManager.updateComment} to persist the change.
   *
   * @example
   * ```typescript
   * comment.unresolve();
   * commentManager.updateComment(comment);
   * ```
   */
  unresolve() {
    this.#state = 'unresolved';
  }

  /**
   * Checks if this comment is a reply to another comment.
   *
   * @returns True if this comment has a parentId, false if it's a root comment
   */
  isReply() {
    return this.parentId !== undefined;
  }

  /**
   * @internal
   */
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

  /**
   * @internal
   */
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

/**
 * Plain object representation of a comment for serialization and storage.
 *
 * @internal
 */
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

/**
 * Events emitted by {@link CommentManager} for comment lifecycle changes.
 *
 * @remarks
 * These events are emitted for both local and remote changes, enabling UI
 * components to react to comment updates from collaborators in real-time.
 *
 * @internal
 */
type CommentManagerEvents = {
  /**
   * Emitted when a new comment is added to the diagram.
   * Includes both locally created comments and comments added by remote collaborators.
   */
  commentAdded: { comment: Comment };

  /**
   * Emitted when an existing comment is modified (message, state, etc.).
   * Includes both local updates and updates from remote collaborators.
   */
  commentUpdated: { comment: Comment };

  /**
   * Emitted when a comment is removed from the diagram.
   * Includes both locally deleted comments and comments deleted by remote collaborators.
   * Note: The comment is provided in serialized form since the Comment instance
   * may no longer exist.
   */
  commentRemoved: { comment: SerializedComment };
};

/**
 * Manages all comments for a diagram.
 *
 * Provides centralized management of comment lifecycle, including creation, updates,
 * deletion, threading, and staleness detection.
 *
 * @remarks
 * The comment manager serves as the single source of truth for all comments in a
 * diagram. It handles:
 * - Adding and removing comments with validation
 * - Updating comment content and state
 * - Managing threaded discussions with parent-child relationships
 * - Recursive deletion of comment threads
 * - Filtering comments by type and staleness
 * - Real-time synchronization via CRDT events
 *
 * ## Threading
 *
 * Comments form tree structures through `parentId` relationships. When deleting a
 * comment, all its nested replies are automatically deleted recursively. Use
 * {@link getCommentThread} to retrieve an entire conversation thread.
 *
 * @example
 * ```typescript
 * // Create manager
 * const manager = new CommentManager(diagram, crdtCommentsMap);
 *
 * // Listen for changes
 * manager.on('commentAdded', ({ comment }) => {
 *   console.log(`${comment.author} added: ${comment.message}`);
 * });
 *
 * // Add a comment
 * const comment = new Comment(
 *   diagram, 'diagram', 'comment-1',
 *   'Great diagram!', 'alice@example.com', new Date()
 * );
 * manager.addComment(comment);
 *
 * // Reply to it
 * const reply = new Comment(
 *   diagram, 'diagram', 'comment-2',
 *   'Thanks!', 'bob@example.com', new Date(),
 *   'unresolved', undefined, comment.id
 * );
 * manager.replyToComment(comment, reply);
 *
 * // Get the full thread
 * const thread = manager.getCommentThread(reply);
 * console.log(`Thread: ${thread.length} comments`);
 *
 * // Get only diagram comments
 * const diagramComments = manager.getDiagramComments();
 *
 * // Clean up
 * manager.release();
 * ```
 */
export class CommentManager extends EventEmitter<CommentManagerEvents> implements Releasable {
  /** Event listener cleanup handlers */
  readonly #releasables = new Releasables();

  /**
   * Creates a new comment manager for a diagram.
   *
   * @param diagram - The diagram this manager handles comments for
   * @param commentsMap - CRDT map for synchronized comment storage
   *
   * @internal
   */
  constructor(
    private diagram: Diagram,
    private commentsMap: CRDTMap<Record<string, SerializedComment>>
  ) {
    super();
    // Forward CRDT remote events as local events for UI to react to
    this.#releasables.add(
      this.commentsMap.on('remoteDelete', p => {
        this.emit('commentRemoved', { comment: p.value });
      })
    );
    this.#releasables.add(
      this.commentsMap.on('remoteInsert', p => {
        const comment = this.getComment(p.key)!;
        this.emit('commentAdded', { comment: comment });
      })
    );
    this.#releasables.add(
      this.commentsMap.on('remoteUpdate', p => {
        const comment = this.getComment(p.key)!;
        this.emit('commentUpdated', { comment: comment });
      })
    );
  }

  /**
   * Releases all event listeners and cleans up resources.
   *
   * @internal
   */
  release(): void {
    this.#releasables.release();
  }

  /**
   * Returns all comments in the diagram.
   *
   * @returns Array of all comments including resolved, unresolved, and stale comments
   *
   * @remarks
   * This method returns every comment without filtering. Use {@link getDiagramComments}
   * or filter the results if you need specific subsets.
   *
   * @example
   * ```typescript
   * const all = manager.getAll();
   * const resolved = all.filter(c => c.state === 'resolved');
   * const stale = all.filter(c => c.isStale());
   * ```
   */
  getAll(): Comment[] {
    return Array.from(this.commentsMap.values()).map(sc => Comment.deserialize(sc, this.diagram));
  }

  /**
   * Returns only diagram-level comments that are not stale.
   *
   * @returns Array of active diagram-level comments
   *
   * @remarks
   * This method filters out:
   * - Element-level comments (attached to specific nodes/edges)
   * - Stale comments (where the element no longer exists)
   *
   * Use this to get general comments about the diagram as a whole, excluding
   * element-specific annotations.
   *
   * @example
   * ```typescript
   * const diagramComments = manager.getDiagramComments();
   * const unresolved = diagramComments.filter(c => c.state === 'unresolved');
   * ```
   */
  getDiagramComments(): Comment[] {
    const result: Comment[] = [];
    for (const serialized of this.commentsMap.values()) {
      if (serialized.type !== 'diagram') continue;

      const comment = Comment.deserialize(serialized, this.diagram);
      if (!comment.isStale()) result.push(comment);
    }
    return result;
  }

  /**
   * Adds a new comment to the diagram.
   *
   * @param comment - The comment to add
   *
   * @throws {Error} If the comment belongs to a different diagram
   *
   * A `commentAdded` event is emitted after successful addition.
   *
   * For reply comments, consider using {@link replyToComment} which validates
   * the parent-child relationship.
   *
   * @example
   * ```typescript
   * const comment = new Comment(
   *   diagram, 'diagram', generateId(),
   *   'Review needed', 'alice@example.com', new Date()
   * );
   * manager.addComment(comment);
   * ```
   */
  addComment(comment: Comment): void {
    precondition.is.true(comment.diagram === this.diagram);

    const serialized = comment.serialize();
    this.commentsMap.set(comment.id, serialized);

    this.emit('commentAdded', { comment });
  }

  /**
   * Updates an existing comment in the diagram.
   *
   * @param comment - The comment with updated properties
   *
   * @throws {Error} If the comment belongs to a different diagram
   *
   * @remarks
   * Call this method after modifying a comment's message, state, or other
   * properties to persist the changes and notify collaborators. If the comment
   * ID doesn't exist in the manager, the update is silently ignored.
   *
   * A `commentUpdated` event is emitted after successful update.
   *
   * @example
   * ```typescript
   * comment.edit('Updated message');
   * manager.updateComment(comment);
   *
   * comment.resolve();
   * manager.updateComment(comment);
   * ```
   */
  updateComment(comment: Comment): void {
    precondition.is.true(comment.diagram === this.diagram);

    if (this.commentsMap.has(comment.id)) {
      const serialized = comment.serialize();
      this.commentsMap.set(comment.id, serialized);

      this.emit('commentUpdated', { comment });
    }
  }

  /**
   * Adds a reply to an existing comment, creating a threaded discussion.
   *
   * @param replyTo - The parent comment being replied to
   * @param reply - The reply comment (must have parentId set to replyTo.id)
   *
   * @throws {Error} If reply.parentId doesn't match replyTo.id
   *
   * @remarks
   * This is a convenience method that validates the parent-child relationship
   * before adding the reply. The reply's `parentId` must be set to the parent
   * comment's ID.
   *
   * @example
   * ```typescript
   * const parent = manager.getComment('comment-1')!;
   * const reply = new Comment(
   *   diagram, 'diagram', generateId(),
   *   'I agree', 'bob@example.com', new Date(),
   *   'unresolved', undefined, parent.id
   * );
   * manager.replyToComment(parent, reply);
   * ```
   */
  replyToComment(replyTo: Comment, reply: Comment): void {
    if (reply.parentId !== replyTo.id) {
      throw new Error('Reply comment must have parentId matching the comment being replied to');
    }
    this.addComment(reply);
  }

  /**
   * Removes a comment and all its replies recursively.
   *
   * @param commentId - ID of the comment to remove
   *
   * @throws {Error} If the comment doesn't exist
   * @throws {Error} If the comment belongs to a different diagram
   *
   * @remarks
   * This method performs recursive deletion: all nested replies are removed
   * before the comment itself is deleted. This ensures thread integrity and
   * prevents orphaned replies.
   *
   * A `commentRemoved` event is emitted for each deleted comment (the target
   * comment and all its replies).
   *
   * @example
   * ```typescript
   * // Deletes the comment and all its replies
   * manager.removeComment('comment-1');
   *
   * // Verify deletion
   * console.log(manager.getComment('comment-1')); // undefined
   * ```
   */
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

  /**
   * Retrieves a comment by its ID.
   *
   * @param commentId - The comment ID to look up
   * @returns The comment if found, undefined otherwise
   **
   * @example
   * ```typescript
   * const comment = manager.getComment('comment-1');
   * if (comment) {
   *   console.log(`Author: ${comment.author}`);
   *   console.log(`Message: ${comment.message}`);
   * }
   * ```
   */
  getComment(commentId: string): Comment | undefined {
    const serialized = this.commentsMap.get(commentId);
    if (!serialized) return undefined;
    return Comment.deserialize(serialized, this.diagram);
  }

  /**
   * Returns all direct replies to a comment (one level deep).
   *
   * @param comment - The parent comment or its ID
   * @returns Array of direct child comments
   *
   * @remarks
   * This method returns only immediate children, not nested replies. Use
   * {@link getCommentThread} to get an entire nested discussion thread.
   *
   * @example
   * ```typescript
   * const replies = manager.getReplies(parentComment);
   * console.log(`${replies.length} direct replies`);
   *
   * // Or pass ID directly
   * const repliesById = manager.getReplies('comment-1');
   * ```
   */
  getReplies(comment: Comment | string): Comment[] {
    const parentId = typeof comment === 'string' ? comment : comment.id;
    const result: Comment[] = [];
    for (const serialized of this.commentsMap.values()) {
      if (serialized.parentId !== parentId) continue;

      result.push(Comment.deserialize(serialized, this.diagram));
    }
    return result;
  }

  /**
   * Returns the complete conversation thread containing a comment.
   *
   * @param comment - Any comment in the thread
   * @returns Array of all comments in the thread, ordered from root to leaves
   *
   * @remarks
   * This method:
   * 1. Walks up the parent chain to find the root comment (no parentId)
   * 2. Recursively collects all replies starting from the root
   * 3. Returns the complete thread in tree order
   *
   * The returned array includes the root comment and all nested replies at any depth.
   * Comments are ordered in depth-first traversal order.
   *
   * @example
   * ```typescript
   * // Get thread from any comment in it
   * const thread = manager.getCommentThread(someReply);
   * console.log(`Full thread: ${thread.length} comments`);
   *
   * const root = thread[0];
   * console.log(`Started by: ${root.author}`);
   *
   * // Display thread structure
   * thread.forEach(c => {
   *   const indent = c.isReply() ? '  '.repeat(getDepth(c)) : '';
   *   console.log(`${indent}${c.author}: ${c.message}`);
   * });
   * ```
   */
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
