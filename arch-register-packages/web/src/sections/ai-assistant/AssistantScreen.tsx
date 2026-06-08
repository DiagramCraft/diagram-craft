import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useNavigate, useSearch } from '@tanstack/react-router';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@diagram-craft/app-components/Button';
import {
  TbSparkles, TbPlus, TbMessageCircle, TbDots,
  TbPencil, TbTrash,
} from 'react-icons/tb';
import styles from './AssistantScreen.module.css';
import { useWorkspaceContext } from '../../layouts/WorkspaceContext';
import { useAuth } from '../../auth/AuthContext';
import { resolveAvatarBackground } from '../../components/MemberAvatar';
import { useAiChat } from '../../hooks/useAiChat';
import {
  useAiConversations,
  useCreateConversation,
  useRenameConversation,
  useDeleteConversation,
  useConversationMessages,
  aiKeys,
} from '../../hooks/useAiConversations';
import type { AiConversation } from '@arch-register/api-types';
import type { WorkspaceTeam } from '../../api';

// ── Markdown renderer ──

const fmtInline = (
  s: string,
  onEntityLink?: (entityId: string) => void
): React.ReactNode[] =>
  s.split(/(\[[^\]]+\]\((?:entity:[^)]+|https?:\/\/[^)]+)\)|\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g).map((p, i) => {
    const entityLinkMatch = /^\[([^\]]+)\]\(entity:([^)]+)\)$/.exec(p);
    if (entityLinkMatch) {
      return (
        <button
          key={i}
          type="button"
          className={styles.inlineEntityLink}
          onClick={() => onEntityLink?.(entityLinkMatch[2]!)}
        >
          {entityLinkMatch[1]}
        </button>
      );
    }

    const externalLinkMatch = /^\[([^\]]+)\]\((https?:\/\/[^)]+)\)$/.exec(p);
    if (externalLinkMatch) {
      return (
        <a
          key={i}
          className={styles.inlineEntityLink}
          href={externalLinkMatch[2]}
          target="_blank"
          rel="noreferrer"
        >
          {externalLinkMatch[1]}
        </a>
      );
    }

    if (/^\*\*[^*]+\*\*$/.test(p)) return <strong key={i}>{p.slice(2, -2)}</strong>;
    if (/^\*[^*]+\*$/.test(p)) return <em key={i}>{p.slice(1, -1)}</em>;
    if (/^`[^`]+`$/.test(p)) return <code key={i} className={styles.inlineCode}>{p.slice(1, -1)}</code>;
    return p;
  });

const AiMarkdown = ({
  text,
  onEntityLink,
}: {
  text: string;
  onEntityLink?: (entityId: string) => void;
}) => {
  const lines = text.split('\n');
  const nodes: React.ReactNode[] = [];
  let i = 0;
  while (i < lines.length) {
    const ln = lines[i]!;
    // Fenced code block
    if (ln.startsWith('```')) {
      const lang = ln.slice(3).trim();
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i]!.startsWith('```')) {
        codeLines.push(lines[i]!);
        i++;
      }
      nodes.push(<pre key={i} className={styles.codeBlock}><code>{lang ? <span className={styles.codeLang}>{lang}</span> : null}{codeLines.join('\n')}</code></pre>);
      i++;
      continue;
    }
    // Heading
    const headMatch = /^(#{1,3})\s+(.+)$/.exec(ln);
    if (headMatch) {
      const level = headMatch[1]!.length;
      const Tag = `h${level}` as 'h1' | 'h2' | 'h3';
      nodes.push(<Tag key={i} className={styles[`heading${level}` as keyof typeof styles]}>{fmtInline(headMatch[2]!, onEntityLink)}</Tag>);
      i++;
      continue;
    }
    // Bullet list item
    if (/^[-*•]\s+/.test(ln)) {
      const items: React.ReactNode[] = [];
      while (i < lines.length && /^[-*•]\s+/.test(lines[i]!)) {
        items.push(<li key={i}>{fmtInline(lines[i]!.replace(/^[-*•]\s+/, ''), onEntityLink)}</li>);
        i++;
      }
      nodes.push(<ul key={`ul-${i}`} className={styles.mdList}>{items}</ul>);
      continue;
    }
    // Numbered list item
    if (/^\d+\.\s+/.test(ln)) {
      const items: React.ReactNode[] = [];
      while (i < lines.length && /^\d+\.\s+/.test(lines[i]!)) {
        items.push(<li key={i}>{fmtInline(lines[i]!.replace(/^\d+\.\s+/, ''), onEntityLink)}</li>);
        i++;
      }
      nodes.push(<ol key={`ol-${i}`} className={styles.mdList}>{items}</ol>);
      continue;
    }
    // Table: detect a pipe-delimited row
    if (/^\|.+\|/.test(ln)) {
      const tableLines: string[] = [];
      while (i < lines.length && /^\|.+\|/.test(lines[i]!)) {
        tableLines.push(lines[i]!);
        i++;
      }
      const parseRow = (row: string) =>
        row.split('|').slice(1, -1).map(c => c.trim());
      const isSeparator = (row: string) => /^[\s|:-]+$/.test(row);
      const [headerRow, ...rest] = tableLines;
      const bodyRows = rest.filter(r => !isSeparator(r));
      const headers = headerRow ? parseRow(headerRow) : [];
      nodes.push(
        <div key={`tbl-${i}`} className={styles.tableWrap}>
          <table className={styles.mdTable}>
            <thead>
              <tr>{headers.map((h, ci) => <th key={ci}>{fmtInline(h, onEntityLink)}</th>)}</tr>
            </thead>
            <tbody>
              {bodyRows.map((row, ri) => (
                <tr key={ri}>
                  {parseRow(row).map((cell, ci) => <td key={ci}>{fmtInline(cell, onEntityLink)}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
      continue;
    }
    // Blank line
    if (ln.trim() === '') {
      nodes.push(<div key={i} className={styles.mdGap} />);
      i++;
      continue;
    }
    // Paragraph
    nodes.push(<p key={i} className={styles.mdPara}>{fmtInline(ln, onEntityLink)}</p>);
    i++;
  }
  return <div className={styles.aiText}>{nodes}</div>;
};

const SUGGESTIONS = [
  'What entities are in the model?',
  'Summarize gaps and risks',
  'Who owns which services?',
  'What dependencies exist?',
];

const isApprovalTool = (name: string) => name === 'create_entity' || name === 'update_entity';

const hasRenderableParts = (
  parts: Array<{ type: string; content?: string; name?: string; approval?: { needsApproval: boolean } }>
) =>
  parts.some(part =>
    (part.type === 'text' && (part.content?.trim().length ?? 0) > 0) ||
    (part.type === 'tool-call' && !!part.name && isApprovalTool(part.name) && part.approval?.needsApproval)
  );

const safeJsonParse = (value: string) => {
  try {
    return JSON.parse(value) as Record<string, unknown>;
  } catch {
    return null;
  }
};

const ownerLabel = (owner: string | null | undefined, teams: WorkspaceTeam[]) =>
  owner == null ? 'Unassigned' : teams.find(team => team.id === owner)?.id ?? owner;

const ApprovalCard = ({
  part,
  teams,
  onApprove,
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
  const fields = (args['fields'] && typeof args['fields'] === 'object' ? args['fields'] : {}) as Record<string, unknown>;
  const fieldEntries = Object.entries(fields);
  const output = part.output && typeof part.output === 'object' ? part.output as Record<string, unknown> : null;
  const outputEntity = output?.['entity'] && typeof output['entity'] === 'object'
    ? output['entity'] as Record<string, unknown>
    : null;

  return (
    <div className={styles.approvalCard}>
      <div className={styles.approvalHead}>
        <div className={styles.approvalTitle}>{title}</div>
        <div className={`${styles.approvalState} ${pending ? styles.approvalStatePending : approved ? styles.approvalStateApproved : styles.approvalStateDeclined}`}>
          {pending ? 'Awaiting approval' : approved ? 'Approved' : 'Declined'}
        </div>
      </div>
      <div className={styles.approvalGrid}>
        {'entityId' in args && typeof args['entityId'] === 'string' && (
          <div><span className={styles.approvalLabel}>Entity</span><span>{String(args['entityId'])}</span></div>
        )}
        {'schemaId' in args && typeof args['schemaId'] === 'string' && (
          <div><span className={styles.approvalLabel}>Schema</span><span>{String(args['schemaId'])}</span></div>
        )}
        {'name' in args && typeof args['name'] === 'string' && (
          <div><span className={styles.approvalLabel}>Name</span><span>{String(args['name'])}</span></div>
        )}
        {'owner' in args && (
          <div><span className={styles.approvalLabel}>Owner</span><span>{ownerLabel(args['owner'] as string | null | undefined, teams)}</span></div>
        )}
        {'lifecycle' in args && (
          <div><span className={styles.approvalLabel}>Lifecycle</span><span>{String(args['lifecycle'] ?? 'None')}</span></div>
        )}
      </div>
      {fieldEntries.length > 0 && (
        <div className={styles.approvalFields}>
          <div className={styles.approvalLabel}>Field changes</div>
          <ul className={styles.approvalList}>
            {fieldEntries.map(([key, value]) => (
              <li key={key}>
                <code>{key}</code> = <span>{typeof value === 'string' ? value : JSON.stringify(value)}</span>
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
          <button type="button" className={styles.approvalApprove} onClick={() => onApprove(approvalId, true)}>
            Approve
          </button>
          <button type="button" className={styles.approvalDecline} onClick={() => onApprove(approvalId, false)}>
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
  onDelete,
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

  const sorted = useMemo(() =>
    [...conversations].sort((a, b) =>
      new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
    ), [conversations]);

  const groups = useMemo(() => {
    const g: Array<{ label: string; items: AiConversation[] }> = [];
    for (const c of sorted) {
      const lbl = bucketLabel(c.updated_at);
      let group = g.find(x => x.label === lbl);
      if (!group) { group = { label: lbl, items: [] }; g.push(group); }
      group.items.push(c);
    }
    return g;
  }, [sorted]);

  return (
    <div className={styles.history}>
      <div className={styles.historyHead}>
        <Button variant="primary" className={styles.newChatBtn} onClick={onNew} icon={<TbPlus size={13} />}>
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
                onClick={() => onSelect(c.id)}
              >
                <span className={`${styles.historyIco} ${c.id === activeId ? styles.historyIcoActive : ''}`}><TbMessageCircle size={12} /></span>
                {renaming === c.id ? (
                  <input
                    className={styles.historyRename}
                    autoFocus
                    defaultValue={c.title}
                    onClick={e => e.stopPropagation()}
                    onBlur={e => { onRename(c.id, e.target.value); setRenaming(null); }}
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
                  onClick={e => { e.stopPropagation(); setMenuFor(menuFor === c.id ? null : c.id); }}
                >
                  <TbDots size={13} />
                </button>
                {menuFor === c.id && (
                  <div className={styles.historyMenu} onMouseDown={e => e.stopPropagation()}>
                    <button type="button" onClick={e => { e.stopPropagation(); setMenuFor(null); setRenaming(c.id); }}>
                      <TbPencil size={12} /> Rename
                    </button>
                    <button type="button" className={styles.historyMenuDanger} onClick={e => { e.stopPropagation(); setMenuFor(null); onDelete(c.id); }}>
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
  const { workspaceSlug, teams } = useWorkspaceContext();
  const { user } = useAuth();
  const navigate = useNavigate();
  const search = useSearch({ strict: false }) as { conversation?: string };
  const queryClient = useQueryClient();

  const [draft, setDraft] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  const conversationId = search.conversation;

  // chatSessionId is the stable identity passed to useChat as its `id` prop.
  // It only changes on explicit user actions (sidebar click, new-chat button, delete).
  // Auto-navigation inside sendMessage updates the URL but NOT chatSessionId, so
  // the hook never reinitializes mid-stream.
  const [chatSessionId, setChatSessionId] = useState<string>(() => conversationId ?? 'new');

  // Conversations
  const { data: conversations = [] } = useAiConversations(workspaceSlug);
  const createConversation = useCreateConversation(workspaceSlug);
  const renameConversation = useRenameConversation(workspaceSlug);
  const deleteConversation = useDeleteConversation(workspaceSlug);

  // Historical messages — shown only when the live chat has no messages yet
  // (e.g. user just selected an old conversation from the sidebar).
  const { data: historicalMessages } = useConversationMessages(workspaceSlug, conversationId);

  // conversationId (from URL) is passed so the connection factory can include it
  // in the x-ar-conversation-id header on every request.
  const chat = useAiChat(workspaceSlug, chatSessionId, conversationId);

  // Invalidate sidebar and messages queries when a streaming response finishes.
  const wasLoadingRef = useRef(false);
  useEffect(() => {
    if (wasLoadingRef.current && !chat.isLoading && conversationId) {
      void queryClient.invalidateQueries({ queryKey: aiKeys.conversations(workspaceSlug) });
      void queryClient.invalidateQueries({ queryKey: aiKeys.messages(workspaceSlug, conversationId) });
    }
    wasLoadingRef.current = chat.isLoading;
  });

  // Display live messages if we have them; otherwise fall back to historical messages
  // from the database (for when the user opens an old conversation).
  const visibleMessages = useMemo(() => {
    if (chat.messages.length > 0) {
      return chat.messages.filter(message =>
        hasRenderableParts(
          message.parts as Array<{ type: string; content?: string; name?: string; approval?: { needsApproval: boolean } }>
        )
      );
    }
    return (historicalMessages ?? []).map(msg => ({
      id: msg.id,
      role: msg.role as 'user' | 'assistant' | 'system',
      parts: [{ type: 'text' as const, content: msg.content }],
      createdAt: new Date(msg.created_at),
    }));
  }, [chat.messages, historicalMessages]);

  // Auto-scroll — deps are triggers, not values consumed by the effect
  // biome-ignore lint/correctness/useExhaustiveDependencies: intentional trigger-only deps
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [visibleMessages.length, chat.isLoading]);

  // Explicit navigation — reinitializes the chat session for the new conversation.
  const selectConversation = useCallback((id: string) => {
    setChatSessionId(id);
    navigate({
      to: '/$workspaceSlug/assistant',
      params: { workspaceSlug },
      search: { conversation: id },
    });
  }, [navigate, workspaceSlug]);

  const navigateToEntity = useCallback((entityId: string) => {
    navigate({
      to: '/$workspaceSlug/entities/$entityId',
      params: { workspaceSlug, entityId },
    });
  }, [navigate, workspaceSlug]);

  const respondToApproval = useCallback((approvalId: string, approved: boolean) => {
    void chat.addToolApprovalResponse({ id: approvalId, approved });
  }, [chat]);

  const handleNew = useCallback(async () => {
    const conv = await createConversation.mutateAsync(undefined);
    setChatSessionId(conv.id);
    navigate({
      to: '/$workspaceSlug/assistant',
      params: { workspaceSlug },
      search: { conversation: conv.id },
    });
    chat.clear();
  }, [createConversation, navigate, workspaceSlug, chat]);

  const handleRename = useCallback((id: string, title: string) => {
    const trimmed = title.trim();
    if (trimmed) renameConversation.mutate({ id, title: trimmed });
  }, [renameConversation]);

  const handleDelete = useCallback((id: string) => {
    deleteConversation.mutate(id);
    if (id === conversationId) {
      setChatSessionId('new');
      navigate({
        to: '/$workspaceSlug/assistant',
        params: { workspaceSlug },
      });
      chat.clear();
    }
  }, [deleteConversation, conversationId, navigate, workspaceSlug, chat]);

  const sendMessage = useCallback((text: string) => {
    if (!text || chat.isLoading || !conversationId) return;

    // Optimistically update the sidebar title as soon as the user sends their first message,
    // without waiting for the server round-trip or stream to complete.
    const cachedConvs = queryClient.getQueryData<AiConversation[]>(aiKeys.conversations(workspaceSlug));
    const conv = cachedConvs?.find(c => c.id === conversationId);
    if (conv?.title === 'New conversation') {
      const title = text.length > 50 ? `${text.substring(0, 47)}...` : text;
      queryClient.setQueryData<AiConversation[]>(
        aiKeys.conversations(workspaceSlug),
        cachedConvs?.map(c => c.id === conversationId ? { ...c, title } : c)
      );
    }

    chat.sendMessage(text);
  }, [chat, conversationId, queryClient, workspaceSlug]);

  const submit = useCallback(() => {
    const text = draft.trim();
    if (!text) return;
    sendMessage(text);
    setDraft('');
  }, [draft, sendMessage]);

  const onKey = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  }, [submit]);

  const isEmpty = visibleMessages.length === 0;

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
              <div className={styles.eyebrow}><TbSparkles size={11} /> Assistant</div>
              <div className={styles.screenTitle}>Ask about your model</div>
            </div>
          </div>
        </div>

        <div className={styles.chatScroll} ref={scrollRef}>
          <div className={styles.chatThread}>
            {isEmpty && !chat.isLoading && (
              <div className={styles.emptyState}>
                <TbSparkles size={32} className={styles.emptyIcon} />
                <div>
                  {conversationId
                    ? 'Ask about entities, relationships, schemas, and the overall model.'
                    : 'Start a new chat to ask about your model.'}
                </div>
              </div>
            )}
            {visibleMessages.map(m => (
              <div key={m.id} className={styles.msg}>
                <div
                  className={`${styles.msgAvatar} ${m.role === 'assistant' ? styles.msgAvatarAssistant : styles.msgAvatarUser}`}
                  style={m.role === 'user' && user ? { background: resolveAvatarBackground(user.id, user.color) } : undefined}
                >
                  {m.role === 'assistant'
                    ? <TbSparkles size={13} />
                    : user
                      ? (user.display_name || user.email || '?').split(/[\s@.]+/).slice(0, 2).map(w => w[0] ?? '').join('').toUpperCase() || '?'
                      : 'U'
                  }
                </div>
                <div className={styles.msgBody}>
                  {m.parts.map((part, i) => {
                    if (part.type === 'text') {
                      return <AiMarkdown key={i} text={part.content} onEntityLink={navigateToEntity} />;
                    }
                    if (part.type === 'tool-call' && isApprovalTool(part.name) && part.approval?.needsApproval) {
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
                  <div className={styles.typing}><span /><span /><span /></div>
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
                onKeyDown={onKey}
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
