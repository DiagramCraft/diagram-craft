import type { TElement } from 'platejs';
import { z } from 'zod';
import type { PlateElementProps } from 'platejs/react';
import { defineWidget } from './defineWidget';

/**
 * Compile-time-only checks for defineWidget's generic constraints.
 * Not run by vitest — verified by `tsc --noEmit` picking up this file (it's
 * included via the same tsconfig `include` as the rest of the package).
 */

interface FooSlateElement extends TElement {
  fooId: string;
}

type FooProps = { id: string };

const FooPreview = (_props: FooProps) => null;

const fooConfigSchema = z.object({ name: z.string() });

const FooEditable = (_props: PlateElementProps<FooSlateElement>) => null;

// Valid call: compiles cleanly.
defineWidget<FooSlateElement, 'block'>({
  type: 'Foo',
  category: 'data-views',
  name: 'Foo',
  description: 'A Foo component.',
  component: FooPreview,
  mdx: {
    mode: 'block',
    allowedProps: ['id'],
    editorSpec: {
      editableComponent: FooEditable,
      nodeOptions: { isVoid: true },
      mdxRule: {
        deserialize: (_mdastNode, _deco, _options) => ({
          type: 'Foo',
          fooId: '',
          children: [{ text: '' }]
        }),
        serialize: _slateNode => ({
          type: 'mdxJsxFlowElement',
          name: 'Foo',
          children: [],
          attributes: []
        })
      }
    }
  }
});

// deserialize returning a shape missing a required field of E (`fooId`).
defineWidget<FooSlateElement, 'block'>({
  type: 'Foo',
  category: 'data-views',
  name: 'Foo',
  description: 'A Foo component.',
  component: FooPreview,
  mdx: {
    mode: 'block',
    allowedProps: ['id'],
    editorSpec: {
      editableComponent: FooEditable,
      nodeOptions: { isVoid: true },
      mdxRule: {
        // @ts-expect-error missing required `fooId` field of FooSlateElement
        deserialize: (_mdastNode, _deco, _options) => ({
          type: 'Foo',
          children: [{ text: '' }]
        }),
        serialize: _slateNode => ({
          type: 'mdxJsxFlowElement',
          name: 'Foo',
          children: [],
          attributes: []
        })
      }
    }
  }
});

// editableComponent typed against the wrong Slate element.
interface OtherSlateElement extends TElement {
  otherId: string;
}
const WrongEditable = (_props: PlateElementProps<OtherSlateElement>) => null;

defineWidget<FooSlateElement, 'block'>({
  type: 'Foo',
  category: 'data-views',
  name: 'Foo',
  description: 'A Foo component.',
  component: FooPreview,
  mdx: {
    mode: 'block',
    allowedProps: ['id'],
    editorSpec: {
      // @ts-expect-error WrongEditable expects OtherSlateElement, not FooSlateElement
      editableComponent: WrongEditable,
      nodeOptions: { isVoid: true },
      mdxRule: {
        deserialize: (_mdastNode, _deco, _options) => ({
          type: 'Foo',
          fooId: '',
          children: [{ text: '' }]
        }),
        serialize: _slateNode => ({
          type: 'mdxJsxFlowElement',
          name: 'Foo',
          children: [],
          attributes: []
        })
      }
    }
  }
});

// Dashboard callbacks receive the config inferred from `configSchema`.
defineWidget({
  type: 'Foo',
  category: 'data-views',
  name: 'Foo',
  description: 'A Foo component.',
  component: FooPreview,
  configSchema: fooConfigSchema,
  dashboard: {
    defaultW: 1,
    defaultH: 1,
    surfaces: ['workspace'],
    getTitle: config => config.name,
    frame: { hideOutsideEdit: config => config.name === '' }
  }
});

defineWidget({
  type: 'Foo',
  category: 'data-views',
  name: 'Foo',
  description: 'A Foo component.',
  component: FooPreview,
  configSchema: fooConfigSchema,
  dashboard: {
    defaultW: 1,
    defaultH: 1,
    surfaces: ['workspace'],
    // @ts-expect-error 'missing' is not a field of the config
    getTitle: config => config.missing
  }
});
