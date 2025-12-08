const EXTRACTION_STRATEGIES: ((p: string) => string | undefined)[] = [
  // Strategy 1: Extract from ```json code block
  (content: string) => {
    const match = content.match(/```json\n([\s\S]*?)\n```/);
    return match?.[1];
  },
  // Strategy 2: Extract from ``` code block (no language specified)
  (content: string) => {
    const match = content.match(/```\n([\s\S]*?)\n```/);
    return match?.[1];
  },
  // Strategy 3: Find any JSON object in the text
  (content: string) => {
    const match = content.match(/\{[\s\S]*\}/);
    return match?.[0];
  }
];

/**
 * Extracts JSON from various content formats (markdown code blocks, plain text)
 * Returns undefined if no valid JSON is found
 */
export const extractJSON = (content: string): unknown | undefined => {
  // Try each strategy in order
  for (const strategy of EXTRACTION_STRATEGIES) {
    const jsonStr = strategy(content);
    if (jsonStr) {
      try {
        return JSON.parse(jsonStr);
      } catch {
        // This strategy didn't produce valid JSON, try the next one
      }
    }
  }

  return undefined;
};

/**
 * Filters out JSON code blocks from content and replaces them with a placeholder
 * Shows partial progress indicator while JSON is being streamed
 */
export const filterJsonFromContent = (content: string): string => {
  const applyingChangesMessage = '\n\n[Applying diagram changes...]\n\n';
  const generatingMessage = '\n\n[Generating diagram...]\n\n';

  // Replace complete JSON code blocks with a placeholder
  let filtered = content.replace(/```json\n[\s\S]*?\n```/g, () => applyingChangesMessage);

  // Also handle plain JSON blocks without language tag
  filtered = filtered.replace(/```\n\{[\s\S]*?\n```/g, () => applyingChangesMessage);

  // Handle incomplete JSON blocks that are still being streamed
  // Look for opening ``` that hasn't been closed yet
  const incompleteJsonMatch = filtered.match(/```json\n[\s\S]*$/);
  if (incompleteJsonMatch) {
    filtered = filtered.replace(/```json\n[\s\S]*$/, generatingMessage);
  }

  const incompleteBlockMatch = filtered.match(/```\n\{[\s\S]*$/);
  if (incompleteBlockMatch) {
    filtered = filtered.replace(/```\n\{[\s\S]*$/, generatingMessage);
  }

  return filtered.trim();
};
