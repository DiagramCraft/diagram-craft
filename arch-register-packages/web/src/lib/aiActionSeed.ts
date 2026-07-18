const STORAGE_KEY = 'ai-action-seed';

export type AiActionSeed = {
  documentTitle: string;
  documentLink: string;
  actionPrompt: string;
  answer: string;
};

export const writeAiActionSeed = (seed: AiActionSeed) => {
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(seed));
};

export const readAndClearAiActionSeed = (): AiActionSeed | null => {
  const raw = sessionStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  sessionStorage.removeItem(STORAGE_KEY);
  try {
    return JSON.parse(raw) as AiActionSeed;
  } catch {
    return null;
  }
};

export const formatAiActionSeedMessage = (seed: AiActionSeed): string =>
  [
    `Continuing from the "${seed.documentTitle}" document (${seed.documentLink}).`,
    '',
    `> **Prompt:** ${seed.actionPrompt}`,
    '',
    `> **Answer:** ${seed.answer}`
  ].join('\n');
