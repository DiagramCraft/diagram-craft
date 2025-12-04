import { describe, test, expect } from 'vitest';
import { extractJSON, filterJsonFromContent } from './aiContentParser';

describe('extractJSON', () => {
  test('should extract JSON from markdown code block with json tag', () => {
    const content = `Here's your diagram:

\`\`\`json
{
  "action": "create",
  "nodes": [
    { "id": "node1", "type": "rect" }
  ]
}
\`\`\``;

    const result = extractJSON(content);

    expect(result).toEqual({
      action: 'create',
      nodes: [{ id: 'node1', type: 'rect' }]
    });
  });

  test('should extract JSON from markdown code block without language tag', () => {
    const content = `\`\`\`
{
  "action": "add",
  "nodes": [
    { "id": "node2", "type": "circle" }
  ]
}
\`\`\``;

    const result = extractJSON(content);

    expect(result).toEqual({
      action: 'add',
      nodes: [{ id: 'node2', type: 'circle' }]
    });
  });

  test('should extract JSON object from plain text', () => {
    const content = `Here is the JSON: { "action": "modify", "modifications": [] }`;

    const result = extractJSON(content);

    expect(result).toEqual({
      action: 'modify',
      modifications: []
    });
  });

  test('should return undefined when multiple JSON objects present without code block', () => {
    // The regex matches from first { to last }, which creates invalid JSON
    const content = `{ "action": "create" } and also { "action": "delete" }`;

    const result = extractJSON(content);

    // This fails to parse because it captures: { "action": "create" } and also { "action": "delete" }
    expect(result).toBeUndefined();
  });

  test('should extract nested JSON correctly', () => {
    const content = `\`\`\`json
{
  "action": "create",
  "nodes": [
    {
      "id": "node1",
      "metadata": {
        "nested": {
          "value": true
        }
      }
    }
  ]
}
\`\`\``;

    const result = extractJSON(content);

    expect(result).toEqual({
      action: 'create',
      nodes: [
        {
          id: 'node1',
          metadata: {
            nested: {
              value: true
            }
          }
        }
      ]
    });
  });

  test('should return undefined for invalid JSON', () => {
    const content = `This is not JSON at all`;

    const result = extractJSON(content);

    expect(result).toBeUndefined();
  });

  test('should return undefined for malformed JSON', () => {
    const content = `\`\`\`json
{
  "action": "create",
  "nodes": [
    { "id": "node1" }
  ]
  // missing closing brace
\`\`\``;

    const result = extractJSON(content);

    expect(result).toBeUndefined();
  });

  test('should handle JSON with trailing text after code block', () => {
    const content = `\`\`\`json
{
  "action": "create",
  "nodes": []
}
\`\`\`

This diagram shows the basic structure.`;

    const result = extractJSON(content);

    expect(result).toEqual({
      action: 'create',
      nodes: []
    });
  });

  test('should handle empty JSON object', () => {
    const content = `\`\`\`json
{}
\`\`\``;

    const result = extractJSON(content);

    expect(result).toEqual({});
  });

  test('should handle JSON arrays', () => {
    const content = `\`\`\`json
{
  "action": "remove",
  "removeIds": ["node1", "node2", "node3"]
}
\`\`\``;

    const result = extractJSON(content);

    expect(result).toEqual({
      action: 'remove',
      removeIds: ['node1', 'node2', 'node3']
    });
  });

  test('should extract JSON from text with leading explanation', () => {
    const content = `I'll create that diagram for you:

\`\`\`json
{
  "action": "create",
  "layout": "auto",
  "nodes": [
    { "id": "start", "type": "circle" }
  ]
}
\`\`\`

The diagram has been created.`;

    const result = extractJSON(content);

    expect(result).toEqual({
      action: 'create',
      layout: 'auto',
      nodes: [{ id: 'start', type: 'circle' }]
    });
  });
});

describe('filterJsonFromContent', () => {
  test('should replace complete JSON code block with placeholder', () => {
    const content = `Here's your diagram:

\`\`\`json
{
  "action": "create",
  "nodes": [
    { "id": "node1", "type": "rect" }
  ]
}
\`\`\`

The diagram has been created.`;

    const result = filterJsonFromContent(content);

    expect(result).toContain('[Applying diagram changes...]');
    expect(result).toContain("Here's your diagram:");
    expect(result).toContain('The diagram has been created.');
    expect(result).not.toContain('```json');
    expect(result).not.toContain('"action"');
  });

  test('should replace code block without language tag if it contains JSON', () => {
    const content = `Creating the diagram:

\`\`\`
{
  "action": "add",
  "nodes": []
}
\`\`\`

Done!`;

    const result = filterJsonFromContent(content);

    expect(result).toContain('[Applying diagram changes...]');
    expect(result).toContain('Creating the diagram:');
    expect(result).toContain('Done!');
    expect(result).not.toContain('```');
    expect(result).not.toContain('"action"');
  });

  test('should replace incomplete JSON code block with generating placeholder', () => {
    const content = `Let me create that:

\`\`\`json
{
  "action": "create",
  "nodes": [`;

    const result = filterJsonFromContent(content);

    expect(result).toContain('[Generating diagram...]');
    expect(result).toContain('Let me create that:');
    expect(result).not.toContain('```json');
  });

  test('should replace incomplete code block without language tag', () => {
    const content = `Here it is:

\`\`\`
{
  "action": "add"`;

    const result = filterJsonFromContent(content);

    expect(result).toContain('[Generating diagram...]');
    expect(result).toContain('Here it is:');
    expect(result).not.toContain('```');
  });

  test('should handle multiple complete JSON blocks', () => {
    const content = `First block:

\`\`\`json
{ "action": "create" }
\`\`\`

Second block:

\`\`\`json
{ "action": "add" }
\`\`\``;

    const result = filterJsonFromContent(content);

    expect(result).toContain('First block:');
    expect(result).toContain('Second block:');
    const matches = result.match(/\[Applying diagram changes\.\.\.\]/g);
    expect(matches).toHaveLength(2);
    expect(result).not.toContain('```json');
  });

  test('should not modify content without JSON blocks', () => {
    const content = 'This is just plain text without any code blocks.';

    const result = filterJsonFromContent(content);

    expect(result).toBe(content);
  });

  test('should preserve text and only filter JSON blocks', () => {
    const content = `I'll create a diagram for you.

The diagram will show:
- Node 1
- Node 2

\`\`\`json
{
  "action": "create",
  "nodes": [
    { "id": "node1" },
    { "id": "node2" }
  ]
}
\`\`\`

Let me know if you need changes!`;

    const result = filterJsonFromContent(content);

    expect(result).toContain("I'll create a diagram for you.");
    expect(result).toContain('The diagram will show:');
    expect(result).toContain('- Node 1');
    expect(result).toContain('- Node 2');
    expect(result).toContain('[Applying diagram changes...]');
    expect(result).toContain('Let me know if you need changes!');
    expect(result).not.toContain('```json');
    expect(result).not.toContain('"id": "node1"');
  });

  test('should trim whitespace from result', () => {
    const content = `

\`\`\`json
{ "action": "create" }
\`\`\`

`;

    const result = filterJsonFromContent(content);

    expect(result).toBe('[Applying diagram changes...]');
  });

  test('should handle streaming content with only opening backticks', () => {
    const content = 'Creating your diagram:\n\n```json\n';

    const result = filterJsonFromContent(content);

    expect(result).toBe('Creating your diagram:\n\n\n\n[Generating diagram...]');
  });

  test('should handle mixed complete and incomplete blocks', () => {
    const content = `Complete:

\`\`\`json
{ "action": "create" }
\`\`\`

Incomplete:

\`\`\`json
{ "action": "add"`;

    const result = filterJsonFromContent(content);

    expect(result).toContain('Complete:');
    expect(result).toContain('Incomplete:');
    expect(result).toContain('[Applying diagram changes...]');
    expect(result).toContain('[Generating diagram...]');
    expect(result).not.toContain('```json');
    expect(result).not.toContain('"action"');
  });
});
