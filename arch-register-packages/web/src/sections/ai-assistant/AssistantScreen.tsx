import { useState, useEffect, useMemo } from 'react';
import { Button } from '@diagram-craft/app-components/Button';
import { TbSparkles, TbPlus, TbMessageCircle, TbDots, TbPencil, TbTrash } from 'react-icons/tb';
import styles from './AssistantScreen.module.css';
import { resolveAvatarBackground } from '../../components/MemberAvatar';
import type { WorkspaceTeam } from '@arch-register/api-types/workspaceConfigContract';
import type { AiConversation } from '@arch-register/api-types/aiContract';
import { EmptyState } from '../../components/EmptyState';
import { SafeMarkdown } from '../../components/SafeMarkdown';
import { useAssistantController } from './useAssistantController';

// ── Markdown renderer ──

const AiMarkdown = ({
  text,
  onEntityLink
}: {
  text: string;
  onEntityLink?: (entityId: string) => void;
}) => {
  return (
    <SafeMarkdown
      text={text}
      onEntityLink={onEntityLink}
      classNames={{
        root: styles.aiText,
        paragraph: styles.mdPara,
        list: styles.mdList,
        inlineCode: styles.inlineCode,
        link: styles.inlineEntityLink,
        codeBlock: styles.codeBlock,
        heading1: styles.heading1,
        heading2: styles.heading2,
        heading3: styles.heading3,
        tableWrap: styles.tableWrap,
        table: styles.mdTable
      }}
    />
  );
};

const SUGGESTIONS = [
  'What entities are in the model?',
  'Summarize gaps and risks',
  'Who owns which services?',
  'What dependencies exist?'
];

const isApprovalTool = (name: string) => name === 'create_entity' || name === 'update_entity';

const safeJsonParse = (value: string) => {
  try {
    return JSON.parse(value) as Record<string, unknown>;
  } catch {
    return null;
  }
};

const ownerLabel = (owner: string | null | undefined, teams: WorkspaceTeam[]) =>
  owner == null ? 'Unassigned' : (teams.find(team => team.id === owner)?.name ?? owner);

const ApprovalCard = ({
  part,
  teams,
  onApprove
}: {
  part: {
    id: string;
    name: string;
    arguments: string;
    approval?: { id: string; approved?: boolean };
    output?: unknown;
  };
  teams: WorkspaceTeam[];
  onApprove: (approvalId: string, approved: boolean) => void;
}) => {
  const args = safeJsonParse(part.arguments) ?? {};
  const approvalId = part.approval?.id;
  const approved = part.approval?.approved;
  const pending = approvalId != null && approved === undefined;
  const title = part.name === 'create_entity' ? 'Create entity' : 'Update entity';
  const fields = (
    args['fields'] && typeof args['fields'] === 'object' ? args['fields'] : {}
  ) as Record<string, unknown>;
  const fieldEntries = Object.entries(fields);
  const output =
    part.output && typeof part.output === 'object'
      ? (part.output as Record<string, unknown>)
      : null;
  const outputEntity =
    output?.['entity'] && typeof output['entity'] === 'object'
      ? (output['entity'] as Record<string, unknown>)
      : null;

  return (
    <div className={styles.approvalCard}>
      <div className={styles.approvalHead}>
        <div className={styles.approvalTitle}>{title}</div>
        <div
          className={`${styles.approvalState} ${pending ? styles.approvalStatePending : approved ? styles.approvalStateApproved : styles.approvalStateDeclined}`}
        >
          {pending ? 'Awaiting approval' : approved ? 'Approved' : 'Declined'}
        </div>
      </div>
      <div className={styles.approvalGrid}>
        {'entityId' in args && typeof args['entityId'] === 'string' && (
          <div>
            <span className={styles.approvalLabel}>Entity</span>
            <span>{String(args['entityId'])}</span>
          </div>
        )}
        {'schemaId' in args && typeof args['schemaId'] === 'string' && (
          <div>
            <span className={styles.approvalLabel}>Schema</span>
            <span>{String(args['schemaId'])}</span>
          </div>
        )}
        {'name' in args && typeof args['name'] === 'string' && (
          <div>
            <span className={styles.approvalLabel}>Name</span>
            <span>{String(args['name'])}</span>
          </div>
        )}
        {'owner' in args && (
          <div>
            <span className={styles.approvalLabel}>Owner</span>
            <span>{ownerLabel(args['owner'] as string | null | undefined, teams)}</span>
          </div>
        )}
        {'lifecycle' in args && (
          <div>
            <span className={styles.approvalLabel}>Lifecycle</span>
            <span>{String(args['lifecycle'] ?? 'None')}</span>
          </div>
        )}
      </div>
      {fieldEntries.length > 0 && (
        <div className={styles.approvalFields}>
          <div className={styles.approvalLabel}>Field changes</div>
          <ul className={styles.approvalList}>
            {fieldEntries.map(([key, value]) => (
              <li key={key}>
                <code>{key}</code> ={' '}
                <span>{typeof value === 'string' ? value : JSON.stringify(value)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {outputEntity && (
        <div className={styles.approvalResult}>
          Result: <span>{String(outputEntity['name'] ?? outputEntity['id'] ?? 'Done')}</span>
        </div>
      )}
      {pending && approvalId && (
        <div className={styles.approvalActions}>
          <button
            type="button"
            className={styles.approvalApprove}
            onClick={() => onApprove(approvalId, true)}
          >
            Approve
          </button>
          <button
            type="button"
            className={styles.approvalDecline}
            onClick={() => onApprove(approvalId, false)}
          >
            Decline
          </button>
        </div>
      )}
    </div>
  );
};

// ── Time helpers ──

const DAY_MS = 86400000;

const relTime = (iso: string) => {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  const h = Math.floor(diff / 3600000);
  const d = Math.floor(diff / DAY_MS);
  if (m < 1) return 'now';
  if (m < 60) return `${m}m`;
  if (h < 24) return `${h}h`;
  if (d < 7) return `${d}d`;
  return `${Math.floor(d / 7)}w`;
};

const bucketLabel = (iso: string) => {
  const ts = new Date(iso).getTime();
  const startToday = new Date();
  startToday.setHours(0, 0, 0, 0);
  if (ts >= startToday.getTime()) return 'Today';
  if (ts >= startToday.getTime() - DAY_MS) return 'Yesterday';
  if (ts >= Date.now() - 7 * DAY_MS) return 'Previous 7 days';
  return 'Older';
};

// ── Chat History Sidebar ──

const ChatHistory = ({
  conversations,
  activeId,
  onSelect,
  onNew,
  onRename,
  onDelete
}: {
  conversations: AiConversation[];
  activeId: string | undefined;
  onSelect: (id: string) => void;
  onNew: () => void;
  onRename: (id: string, title: string) => void;
  onDelete: (id: string) => void;
}) => {
  const [renaming, setRenaming] = useState<string | null>(null);
  const [menuFor, setMenuFor] = useState<string | null>(null);

  useEffect(() => {
    if (!menuFor) return;
    const close = () => setMenuFor(null);
    window.addEventListener('mousedown', close);
    return () => window.removeEventListener('mousedown', close);
  }, [menuFor]);

  const sorted = useMemo(
    () =>
      [...conversations].sort(
        (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
      ),
    [conversations]
  );

  const groups = useMemo(() => {
    const g: Array<{ label: string; items: AiConversation[] }> = [];
    for (const c of sorted) {
      const lbl = bucketLabel(c.updated_at);
      let group = g.find(x => x.label === lbl);
      if (!group) {
        group = { label: lbl, items: [] };
        g.push(group);
      }
      group.items.push(c);
    }
    return g;
  }, [sorted]);

  return (
    <div className={styles.history}>
      <div className={styles.historyHead}>
        <Button
          variant="primary"
          className={styles.newChatBtn}
          onClick={onNew}
          icon={<TbPlus size={13} />}
        >
          New chat
        </Button>
      </div>
      <div className={styles.historyScroll}>
        {groups.map(g => (
          <div className={styles.historyGroup} key={g.label}>
            <div className={styles.historyLabel}>{g.label}</div>
            {g.items.map(c => (
              <div
                key={c.id}
                className={`${styles.historyItem} ${c.id === activeId ? styles.historyItemActive : ''}`}
                aria-current={c.id === activeId ? 'page' : undefined}
                onClick={() => onSelect(c.id)}
              >
                <span
                  className={`${styles.historyIco} ${c.id === activeId ? styles.historyIcoActive : ''}`}
                >
                  <TbMessageCircle size={12} />
                </span>
                {renaming === c.id ? (
                  <input
                    className={styles.historyRename}
                    autoFocus
                    defaultValue={c.title}
                    onClick={e => e.stopPropagation()}
                    onBlur={e => {
                      onRename(c.id, e.target.value);
                      setRenaming(null);
                    }}
                    onKeyDown={e => {
                      e.stopPropagation();
                      if (e.key === 'Enter') {
                        onRename(c.id, (e.target as HTMLInputElement).value);
                        setRenaming(null);
                      }
                      if (e.key === 'Escape') setRenaming(null);
                    }}
                  />
                ) : (
                  <span className={styles.historyTitle}>{c.title}</span>
                )}
                <span className={styles.historyTime}>{relTime(c.updated_at)}</span>
                <button
                  type="button"
                  className={styles.historyKebab}
                  title="More"
                  onClick={e => {
                    e.stopPropagation();
                    setMenuFor(menuFor === c.id ? null : c.id);
                  }}
                >
                  <TbDots size={13} />
                </button>
                {menuFor === c.id && (
                  <div className={styles.historyMenu} onMouseDown={e => e.stopPropagation()}>
                    <button
                      type="button"
                      onClick={e => {
                        e.stopPropagation();
                        setMenuFor(null);
                        setRenaming(c.id);
                      }}
                    >
                      <TbPencil size={12} /> Rename
                    </button>
                    <button
                      type="button"
                      className={styles.historyMenuDanger}
                      onClick={e => {
                        e.stopPropagation();
                        setMenuFor(null);
                        onDelete(c.id);
                      }}
                    >
                      <TbTrash size={12} /> Delete
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
};

// ── Main Screen ──

export const AssistantScreen = () => {
  const {
    teams,
    user,
    conversations,
    conversationId,
    chat,
    visibleMessages,
    draft,
    setDraft,
    scrollRef,
    isEmpty,
    selectConversation,
    navigateToEntity,
    respondToApproval,
    handleNew,
    handleRename,
    handleDelete,
    sendMessage,
    submit,
    onKeyDown
  } = useAssistantController();

  return (
    <div className={styles.assistant}>
      <ChatHistory
        conversations={conversations}
        activeId={conversationId}
        onSelect={selectConversation}
        onNew={handleNew}
        onRename={handleRename}
        onDelete={handleDelete}
      />

      <div className={styles.chatCol}>
        <div className={styles.chatHeader}>
          <div className={styles.chatHeaderL}>
            <div>
              <div className={styles.eyebrow}>
                <TbSparkles size={11} /> Assistant
              </div>
              <div className={styles.screenTitle}>Ask about your model</div>
            </div>
          </div>
        </div>

        <div className={styles.chatScroll} ref={scrollRef}>
          <div className={styles.chatThread}>
            {isEmpty && !chat.isLoading && (
              <EmptyState
                icon={<TbSparkles size={32} />}
                title={
                  conversationId
                    ? 'Ask about entities, relationships, schemas, and the overall model.'
                    : 'Start a new chat to ask about your model.'
                }
              />
            )}
            {visibleMessages.map(m => (
              <div key={m.id} className={styles.msg}>
                <div
                  className={`${styles.msgAvatar} ${m.role === 'assistant' ? styles.msgAvatarAssistant : styles.msgAvatarUser}`}
                  style={
                    m.role === 'user' && user
                      ? { background: resolveAvatarBackground(user.id, user.color) }
                      : undefined
                  }
                >
                  {m.role === 'assistant' ? (
                    <TbSparkles size={13} />
                  ) : user ? (
                    (user.display_name || user.email || '?')
                      .split(/[\s@.]+/)
                      .slice(0, 2)
                      .map(w => w[0] ?? '')
                      .join('')
                      .toUpperCase() || '?'
                  ) : (
                    'U'
                  )}
                </div>
                <div className={styles.msgBody}>
                  {m.parts.map((part, i) => {
                    if (part.type === 'text') {
                      return (
                        <AiMarkdown key={i} text={part.content} onEntityLink={navigateToEntity} />
                      );
                    }
                    if (
                      part.type === 'tool-call' &&
                      isApprovalTool(part.name) &&
                      part.approval?.needsApproval
                    ) {
                      return (
                        <ApprovalCard
                          key={i}
                          part={part}
                          teams={teams}
                          onApprove={respondToApproval}
                        />
                      );
                    }
                    return null;
                  })}
                </div>
              </div>
            ))}
            {chat.isLoading && (
              <div className={styles.msg}>
                <div className={`${styles.msgAvatar} ${styles.msgAvatarAssistant}`}>
                  <TbSparkles size={13} />
                </div>
                <div className={styles.msgBody}>
                  <div className={styles.typing}>
                    <span />
                    <span />
                    <span />
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {conversationId && isEmpty && !chat.isLoading && (
          <div className={styles.suggest}>
            {SUGGESTIONS.map(s => (
              <button
                type="button"
                key={s}
                className={styles.suggestChip}
                onClick={() => sendMessage(s)}
              >
                {s}
              </button>
            ))}
          </div>
        )}

        {conversationId ? (
          <>
            <div className={styles.composer}>
              <textarea
                className={styles.composerInput}
                placeholder="Ask a question, or describe a change..."
                value={draft}
                rows={1}
                onChange={e => setDraft(e.target.value)}
                onKeyDown={onKeyDown}
              />
              <button
                type="button"
                className={styles.composerSend}
                disabled={!draft.trim() || chat.isLoading}
                onClick={() => void submit()}
                title="Send (Enter)"
              >
                <TbSparkles size={14} />
              </button>
            </div>
            <div className={styles.composerHint}>Proposes changes for your review</div>
          </>
        ) : (
          <div className={styles.noConversation}>
            <Button variant="primary" onClick={handleNew} icon={<TbPlus size={14} />}>
              New chat
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};
