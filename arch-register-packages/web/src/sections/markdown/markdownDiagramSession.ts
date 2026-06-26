export type DiagramSessionRecord = { id: string; path: string; name?: string };

export type MarkdownDiagramRollbackRecord = {
  diagramId: string;
  path: string;
  name: string;
  originalContent: string;
  originalContentHash: string;
  lastSavedContentHash?: string;
  sawCollaborators: boolean;
};

export type MarkdownCloseDiagramReason = 'collaborative' | 'changed';

export type MarkdownCloseDiagramImpact = {
  diagramId: string;
  path: string;
  name: string;
  reason?: MarkdownCloseDiagramReason;
};

export type MarkdownCloseImpactSummary = {
  createdDiagramsToDelete: DiagramSessionRecord[];
  revertableDiagrams: MarkdownCloseDiagramImpact[];
  nonRevertableDiagrams: MarkdownCloseDiagramImpact[];
};

const STORAGE_KEY = 'markdown-diagram-session-v1';

const getStorage = () => {
  if (typeof window === 'undefined') return undefined;
  return window.sessionStorage;
};

const readAllSessions = (): Record<string, MarkdownDiagramRollbackRecord[]> => {
  const storage = getStorage();
  if (!storage) return {};

  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, MarkdownDiagramRollbackRecord[]>;
    return parsed;
  } catch {
    return {};
  }
};

const writeAllSessions = (allSessions: Record<string, MarkdownDiagramRollbackRecord[]>) => {
  const storage = getStorage();
  if (!storage) return;
  storage.setItem(STORAGE_KEY, JSON.stringify(allSessions));
};

const writeSessionRecords = (sessionId: string, records: MarkdownDiagramRollbackRecord[]) => {
  const allSessions = readAllSessions();
  allSessions[sessionId] = records;
  writeAllSessions(allSessions);
};

export const hashDiagramContent = (content: string): string => {
  let hash = 2166136261;

  for (let i = 0; i < content.length; i++) {
    hash ^= content.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }

  return (hash >>> 0).toString(16);
};

export const getMarkdownDiagramRollbackRecords = (
  sessionId: string
): MarkdownDiagramRollbackRecord[] => {
  const allSessions = readAllSessions();
  return allSessions[sessionId] ?? [];
};

export const rememberMarkdownDiagramOriginal = (
  sessionId: string,
  record: {
    diagramId: string;
    path: string;
    name: string;
    originalContent: string;
  }
) => {
  const records = getMarkdownDiagramRollbackRecords(sessionId);
  if (records.some(existing => existing.diagramId === record.diagramId)) return;

  writeSessionRecords(sessionId, [
    ...records,
    {
      diagramId: record.diagramId,
      path: record.path,
      name: record.name,
      originalContent: record.originalContent,
      originalContentHash: hashDiagramContent(record.originalContent),
      sawCollaborators: false
    }
  ]);
};

export const updateMarkdownDiagramSessionRecord = (
  sessionId: string,
  diagramId: string,
  update: Partial<MarkdownDiagramRollbackRecord>
) => {
  const records = getMarkdownDiagramRollbackRecords(sessionId);
  const nextRecords = records.map(record =>
    record.diagramId === diagramId
      ? {
          ...record,
          ...update,
          sawCollaborators: record.sawCollaborators || (update.sawCollaborators ?? false)
        }
      : record
  );

  writeSessionRecords(sessionId, nextRecords);
};

export const clearMarkdownDiagramSession = (sessionId: string) => {
  const allSessions = readAllSessions();
  delete allSessions[sessionId];
  writeAllSessions(allSessions);
};

export const buildMarkdownCloseImpactSummary = ({
  createdDiagrams,
  records,
  savedBody,
  currentContentHashes
}: {
  createdDiagrams: DiagramSessionRecord[];
  records: MarkdownDiagramRollbackRecord[];
  savedBody: string;
  currentContentHashes: Record<string, string | undefined>;
}): MarkdownCloseImpactSummary => {
  const createdDiagramIdsToDelete = new Set(
    createdDiagrams.filter(record => !savedBody.includes(record.id)).map(record => record.id)
  );

  const revertableDiagrams: MarkdownCloseDiagramImpact[] = [];
  const nonRevertableDiagrams: MarkdownCloseDiagramImpact[] = [];

  for (const record of records) {
    if (!record.lastSavedContentHash) continue;
    if (createdDiagramIdsToDelete.has(record.diagramId)) continue;

    const baseImpact = {
      diagramId: record.diagramId,
      path: record.path,
      name: record.name
    };

    if (record.sawCollaborators) {
      nonRevertableDiagrams.push({ ...baseImpact, reason: 'collaborative' });
      continue;
    }

    const currentHash = currentContentHashes[record.diagramId];
    if (currentHash !== record.lastSavedContentHash) {
      nonRevertableDiagrams.push({ ...baseImpact, reason: 'changed' });
      continue;
    }

    revertableDiagrams.push(baseImpact);
  }

  return {
    createdDiagramsToDelete: createdDiagrams.filter(record => createdDiagramIdsToDelete.has(record.id)),
    revertableDiagrams,
    nonRevertableDiagrams
  };
};
