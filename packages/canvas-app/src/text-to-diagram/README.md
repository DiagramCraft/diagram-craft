# Text-to-Diagram System

This system provides a pluggable architecture for converting between text representations and diagram structures.

## Architecture

The system is designed around format-agnostic interfaces and a registry pattern, allowing multiple text formats to be
supported:

### Core Components

- **types.ts** - Shared types (`ParsedElement`, `ParseErrors`)
- **interfaces.ts** - Core interfaces (`DiagramParser`, `DiagramSerializer`, `SyntaxHighlighter`, `DiagramFormat`)
- **registry.ts** - Format registry (simple `Map<string, DiagramFormat>`) with default format pre-registered
- **textToDiagram.ts** - Core logic for converting parsed elements to diagram (format-agnostic)
- **validation.ts** - Shared validation rules that work across all formats

### Format Structure

Each format is self-contained in `formats/<format-name>/`:

```
formats/
├── default/
│   ├── parser.ts           # Parser implementation
│   ├── parser.test.ts      # Parser tests
│   ├── serializer.ts       # Serializer implementation
│   ├── serializer.test.ts  # Serializer tests
│   ├── syntaxHighlighter.ts # Syntax highlighter
│   └── index.ts            # Format definition
└── [future formats]/
```

## Default Format

The default format uses a custom syntax designed for Diagram Craft:

```
node1: rect "Hello"
node2: circle "World" {
  stylesheet: primary / h1
  props: "fill.color=#ff0000"
}
e1: edge node1 -> node2 "connects to"
: rect "Auto-generated ID"
```

See `formats/default/parser.ts` for complete grammar documentation.

## Adding a New Format

To add a new format (e.g., Mermaid, PlantUML):

1. Create a new directory under `formats/`:
   ```
   formats/my-format/
   ```

2. Implement the required interfaces:
   ```typescript
   // parser.ts
   import type { DiagramParser } from '../../interfaces';
   import type { ParsedElement, ParseErrors } from '../../types';

   export const myFormatParser: DiagramParser = {
     parse(text: string): { elements: ParsedElement[]; errors: ParseErrors } {
       // Your parser implementation
       // Must return ParsedElement[] - the format-agnostic representation
     }
   };
   ```

3. Implement the serializer:
   ```typescript
   // serializer.ts
   import type { DiagramSerializer } from '../../interfaces';
   import type { RegularLayer } from '@diagram-craft/model/diagramLayerRegular';

   export const myFormatSerializer: DiagramSerializer = {
     serialize(layer: RegularLayer): string[] {
       // Convert diagram to your format's text representation
     }
   };
   ```

4. Optionally implement syntax highlighter:
   ```typescript
   // syntaxHighlighter.ts
   import type { SyntaxHighlighter } from '../../interfaces';

   export const myFormatHighlighter: SyntaxHighlighter = {
     highlight(lines: string[], errors: ParseErrors): string[] {
       // Return HTML strings with syntax highlighting
     }
   };
   ```

5. Create format definition:
   ```typescript
   // index.ts
   import type { DiagramFormat } from '../../interfaces';
   import { myFormatParser } from './parser';
   import { myFormatSerializer } from './serializer';
   import { myFormatHighlighter } from './syntaxHighlighter';

   export const myFormat: DiagramFormat = {
     id: 'my-format',
     name: 'My Format',
     description: 'Description of my format',
     parser: myFormatParser,
     serializer: myFormatSerializer,
     syntaxHighlighter: myFormatHighlighter
   };
   ```

6. Register the format:
   ```typescript
   import { formatRegistry } from '@diagram-craft/canvas-app/text-to-diagram/registry';
   import { myFormat } from './formats/my-format';

   formatRegistry.set(myFormat.id, myFormat);
   ```

## Using the System

### Getting the Default Format

```typescript
import {formatRegistry, DEFAULT_FORMAT_ID} from '@diagram-craft/canvas-app/text-to-diagram/registry';

const format = formatRegistry.get(DEFAULT_FORMAT_ID);
if (!format) throw new Error('Default format not found');
```

### Parsing Text

```typescript
const text = 'node1: rect "Hello"';
const result = format.parser.parse(text);

if (result.errors.size === 0) {
  // No errors - use result.elements
} else {
  // Handle errors
}
```

### Serializing Diagram

```typescript
const lines = format.serializer.serialize(layer);
const text = lines.join('\n');
```

### Converting to Diagram

```typescript
import {textToDiagram} from '@diagram-craft/canvas-app/text-to-diagram/textToDiagram';

const result = format.parser.parse(text);
if (result.errors.size === 0) {
  textToDiagram(result.elements, diagram);
}
```
