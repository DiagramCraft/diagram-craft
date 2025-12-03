import { mustExist } from '@diagram-craft/utils/assert';

/**
 * Extracts JSON from various content formats (markdown code blocks, plain text)
 * Returns undefined if no valid JSON is found
 */
export const extractJSON = (content: string): unknown | undefined => {
  // Try to extract JSON from markdown code blocks
  const jsonMatch =
    content.match(/```json\n([\s\S]*?)\n```/) || content.match(/```\n([\s\S]*?)\n```/);

  let jsonStr = mustExist(jsonMatch ? jsonMatch[1] : content);

  // Try to find JSON object in the response
  const jsonObjectMatch = jsonStr.match(/\{[\s\S]*\}/);
  if (jsonObjectMatch) {
    jsonStr = jsonObjectMatch[0];
  }

  try {
    return JSON.parse(jsonStr);
  } catch (_e) {
    return undefined;
  }
};

/**
 * Filters out JSON code blocks from content and replaces them with a placeholder
 * Shows partial progress indicator while JSON is being streamed
 */
export const filterJsonFromContent = (content: string): string => {
  // Replace complete JSON code blocks with a placeholder
  let filtered = content.replace(/```json\n[\s\S]*?\n```/g, () => {
    return '\n\n[Applying diagram changes...]\n\n';
  });

  // Also handle plain JSON blocks without language tag
  filtered = filtered.replace(/```\n\{[\s\S]*?\n```/g, () => {
    return '\n\n[Applying diagram changes...]\n\n';
  });

  // Handle incomplete JSON blocks that are still being streamed
  // Look for opening ``` that hasn't been closed yet
  const incompleteJsonMatch = filtered.match(/```json\n[\s\S]*$/);
  if (incompleteJsonMatch) {
    filtered = filtered.replace(/```json\n[\s\S]*$/, '\n\n[Generating diagram...]\n\n');
  }

  const incompleteBlockMatch = filtered.match(/```\n\{[\s\S]*$/);
  if (incompleteBlockMatch) {
    filtered = filtered.replace(/```\n\{[\s\S]*$/, '\n\n[Generating diagram...]\n\n');
  }

  return filtered.trim();
};
