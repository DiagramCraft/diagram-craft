import type { TElement } from 'platejs';
import type { PlateElementProps } from 'platejs/react';
import { defineComponent } from './defineComponent';

/**
 * Compile-time-only checks for defineComponent's generic constraints.
 * Not run by vitest — verified by `tsc --noEmit` picking up this file (it's
 * included via the same tsconfig `include` as the rest of the package).
 */

interface FooSlateElement extends TElement {
  fooId: string;
}

type FooProps = { id: string };

const FooPreview = (_props: FooProps) => null;

const FooEditable = (_props: PlateElementProps<FooSlateElement>) => null;

// Valid call: compiles cleanly.
defineComponent<FooSlateElement, FooProps, 'block'>({
  type: 'Foo',
  category: 'data-views',
  name: 'Foo',
  description: 'A Foo component.',
  component: FooPreview,
  mdxComponent: {
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

// allowedProps containing a key that isn't a prop of the preview component.
defineComponent<FooSlateElement, FooProps, 'block'>({
  type: 'Foo',
  category: 'data-views',
  name: 'Foo',
  description: 'A Foo component.',
  component: FooPreview,
  mdxComponent: {
    mode: 'block',
    // @ts-expect-error 'bogus' is not a key of FooProps
    allowedProps: ['bogus']
  }
});

// deserialize returning a shape missing a required field of E (`fooId`).
defineComponent<FooSlateElement, FooProps, 'block'>({
  type: 'Foo',
  category: 'data-views',
  name: 'Foo',
  description: 'A Foo component.',
  component: FooPreview,
  mdxComponent: {
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

defineComponent<FooSlateElement, FooProps, 'block'>({
  type: 'Foo',
  category: 'data-views',
  name: 'Foo',
  description: 'A Foo component.',
  component: FooPreview,
  mdxComponent: {
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
