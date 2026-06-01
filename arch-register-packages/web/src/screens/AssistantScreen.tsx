import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useNavigate, useSearch } from '@tanstack/react-router';
import {
  TbSparkles, TbPlus, TbMessageCircle, TbDots,
  TbPencil, TbTrash,
} from 'react-icons/tb';
import styles from './AssistantScreen.module.css';
import { useWorkspaceContext } from '../layouts/WorkspaceContext';
import { useAuth } from '../auth/AuthContext';
import { resolveAvatarBackground } from '../components/MemberAvatar';
import { useAiChat } from '../hooks/useAiChat';
import {
  useAiConversations,
  useCreateConversation,
  useRenameConversation,
  useDeleteConversation,
} from '../hooks/useAiConversations';
import type { AiConversation } from '@arch-register/api-types';

// ── Markdown renderer ──

const fmtInline = (s: string): React.ReactNode[] =>
  s.split(/(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g).map((p, i) => {
    if (/^\*\*[^*]+\*\*$/.test(p)) return <strong key={i}>{p.slice(2, -2)}</strong>;
    if (/^\*[^*]+\*$/.test(p)) return <em key={i}>{p.slice(1, -1)}</em>;
    if (/^`[^`]+`$/.test(p)) return <code key={i} className={styles.inlineCode}>{p.slice(1, -1)}</code>;
    return p;
  });

const AiMarkdown = ({ text }: { text: string }) => {
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
      nodes.push(<Tag key={i} className={styles[`heading${level}` as keyof typeof styles]}>{fmtInline(headMatch[2]!)}</Tag>);
      i++;
      continue;
    }
    // Bullet list item
    if (/^[-*•]\s+/.test(ln)) {
      const items: React.ReactNode[] = [];
      while (i < lines.length && /^[-*•]\s+/.test(lines[i]!)) {
        items.push(<li key={i}>{fmtInline(lines[i]!.replace(/^[-*•]\s+/, ''))}</li>);
        i++;
      }
      nodes.push(<ul key={`ul-${i}`} className={styles.mdList}>{items}</ul>);
      continue;
    }
    // Numbered list item
    if (/^\d+\.\s+/.test(ln)) {
      const items: React.ReactNode[] = [];
      while (i < lines.length && /^\d+\.\s+/.test(lines[i]!)) {
        items.push(<li key={i}>{fmtInline(lines[i]!.replace(/^\d+\.\s+/, ''))}</li>);
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
      const isSeparator = (row: string) => /^[\s|:\-]+$/.test(row);
      const [headerRow, ...rest] = tableLines;
      const bodyRows = rest.filter(r => !isSeparator(r));
      const headers = headerRow ? parseRow(headerRow) : [];
      nodes.push(
        <div key={`tbl-${i}`} className={styles.tableWrap}>
          <table className={styles.mdTable}>
            <thead>
              <tr>{headers.map((h, ci) => <th key={ci}>{fmtInline(h)}</th>)}</tr>
            </thead>
            <tbody>
              {bodyRows.map((row, ri) => (
                <tr key={ri}>
                  {parseRow(row).map((cell, ci) => <td key={ci}>{fmtInline(cell)}</td>)}
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
    nodes.push(<p key={i} className={styles.mdPara}>{fmtInline(ln)}</p>);
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

// ── Time helpers ──

const relTime = (iso: string) => {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  const h = Math.floor(diff / 3600000);
  const d = Math.floor(diff / 86400000);
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
  const day = 86400000;
  if (ts >= startToday.getTime()) return 'Today';
  if (ts >= startToday.getTime() - day) return 'Yesterday';
  if (ts >= Date.now() - 7 * day) return 'Previous 7 days';
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
        <button type="button" className={styles.newChatBtn} onClick={onNew}>
          <TbPlus size={13} /> New chat
        </button>
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
  const { workspaceSlug } = useWorkspaceContext();
  const { user } = useAuth();
  const navigate = useNavigate();
  const search = useSearch({ strict: false }) as { conversation?: string };

  const [draft, setDraft] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  const conversationId = search.conversation;

  // Conversations
  const { data: conversations = [] } = useAiConversations(workspaceSlug);
  const createConversation = useCreateConversation(workspaceSlug);
  const renameConversation = useRenameConversation(workspaceSlug);
  const deleteConversation = useDeleteConversation(workspaceSlug);

  // Chat
  const chat = useAiChat(workspaceSlug, conversationId);

  // Auto-scroll
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [chat.messages.length, chat.isLoading]);

  const selectConversation = useCallback((id: string) => {
    navigate({
      to: '/$workspaceSlug/assistant',
      params: { workspaceSlug },
      search: { conversation: id },
    });
  }, [navigate, workspaceSlug]);

  const handleNew = useCallback(async () => {
    const conv = await createConversation.mutateAsync(undefined);
    selectConversation(conv.id);
    chat.clear();
  }, [createConversation, selectConversation, chat]);

  const handleRename = useCallback((id: string, title: string) => {
    const trimmed = title.trim();
    if (trimmed) renameConversation.mutate({ id, title: trimmed });
  }, [renameConversation]);

  const handleDelete = useCallback((id: string) => {
    deleteConversation.mutate(id);
    if (id === conversationId) {
      navigate({
        to: '/$workspaceSlug/assistant',
        params: { workspaceSlug },
      });
      chat.clear();
    }
  }, [deleteConversation, conversationId, navigate, workspaceSlug, chat]);

  const submit = useCallback(() => {
    const text = draft.trim();
    if (!text || chat.isLoading) return;
    chat.sendMessage(text);
    setDraft('');
  }, [draft, chat]);

  const onKey = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  }, [submit]);

  const isEmpty = chat.messages.length === 0;

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
          <div className={styles.chatHeaderR}>
            <span className={styles.modelChip}><span className={styles.modelDot} /> arch-assistant</span>
            <button type="button" className={styles.newBtn} onClick={handleNew} title="New chat">
              <TbPlus size={12} /> New
            </button>
          </div>
        </div>

        <div className={styles.chatScroll} ref={scrollRef}>
          <div className={styles.chatThread}>
            {isEmpty && !chat.isLoading && (
              <div className={styles.emptyState}>
                <TbSparkles size={32} className={styles.emptyIcon} />
                <div>Ask about entities, relationships, schemas, and the overall model.</div>
              </div>
            )}
            {chat.messages.map(m => (
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
                    if (part.type === 'text') return <AiMarkdown key={i} text={part.content} />;
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

        {isEmpty && !chat.isLoading && (
          <div className={styles.suggest}>
            {SUGGESTIONS.map(s => (
              <button
                type="button"
                key={s}
                className={styles.suggestChip}
                onClick={() => chat.sendMessage(s)}
              >
                {s}
              </button>
            ))}
          </div>
        )}

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
            onClick={submit}
            title="Send (Enter)"
          >
            <TbSparkles size={14} />
          </button>
        </div>
        <div className={styles.composerHint}>Proposes changes for your review</div>
      </div>
    </div>
  );
};
