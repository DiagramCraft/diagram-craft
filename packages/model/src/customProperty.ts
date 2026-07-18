import { DiagramNode } from './diagramNode';
import { UnitOfWork } from './unitOfWork';
import type { Property } from './property';
import type { EdgeProps, NodeProps } from './diagramProps';
import { DynamicAccessor, PropPath } from '@diagram-craft/utils/propertyPath';
import { DiagramEdge } from '@diagram-craft/model/diagramEdge';
import type { DataSchema } from '@diagram-craft/model/diagramDocumentDataSchemas';
import { DiagramElement } from './diagramElement';

// biome-ignore lint/suspicious/noExplicitAny: convenient
export interface CustomPropertyType<T = any> {
  id: string;
  type: string;
  label: string;

  isSet: boolean;
  get: () => T;
  set: (value: T | undefined, uow: UnitOfWork) => void;
}

export interface NumberCustomPropertyType extends CustomPropertyType<number> {
  type: 'number';
  minValue?: number;
  maxValue?: number;
  step?: number;
  unit?: string;
}

export interface SelectCustomPropertyType extends CustomPropertyType<string> {
  type: 'select';
  options: ReadonlyArray<{ value: string; label: string }>;
}

export interface BooleanCustomPropertyType extends CustomPropertyType<boolean> {
  type: 'boolean';
}

export interface IconCustomPropertyType extends CustomPropertyType<string> {
  type: 'icon';
}

export interface ColorCustomPropertyType extends CustomPropertyType<string> {
  type: 'color';
}

export interface TextCustomPropertyType extends CustomPropertyType<string> {
  type: 'text';
}

declare global {
  namespace DiagramCraft {
    interface CustomPropertyTypes {
      number: NumberCustomPropertyType;
      select: SelectCustomPropertyType;
      boolean: BooleanCustomPropertyType;
      icon: IconCustomPropertyType;
      color: ColorCustomPropertyType;
      text: TextCustomPropertyType;
    }
  }
}

type CommonCustomPropertyOpts<T> = {
  validate?: (value: T) => boolean;
  format?: (value: T) => T;
};

const labelToId = (label: string) => label.toLowerCase().replace(/\s/g, '-');

const makeCustomPropertyHelper = <T extends DiagramElement, P>() => {
  return {
    number: (
      el: T,
      label: string,
      property: PropPath<P>,
      opts?: Partial<NumberCustomPropertyType & CommonCustomPropertyOpts<number>>
    ): NumberCustomPropertyType => {
      const acc = new DynamicAccessor<P>();
      return {
        id: labelToId(label),
        type: 'number',
        label,
        isSet: acc.get(el.storedProps as P, property) !== undefined,
        get: () => acc.get(el.renderProps as P, property) as number,
        set: (value: number | undefined, uow: UnitOfWork) => {
          if (value !== undefined && opts?.validate && !opts.validate(value)) return;
          if (value !== undefined && opts?.format) value = opts.format(value);
          // @ts-expect-error
          el.updateProps(p => acc.set(p, property, value), uow);
        },
        ...opts
      };
    },

    boolean: (
      el: T,
      label: string,
      property: PropPath<P>,
      opts?: Partial<BooleanCustomPropertyType>
    ): BooleanCustomPropertyType => {
      const acc = new DynamicAccessor<P>();
      return {
        id: labelToId(label),
        type: 'boolean',
        label,
        isSet: acc.get(el.storedProps as P, property) !== undefined,
        get: () => acc.get(el.renderProps as P, property) as boolean,
        set: (value: boolean | undefined, uow: UnitOfWork) => {
          // @ts-expect-error
          el.updateProps(p => acc.set(p, property, value), uow);
        },
        ...opts
      };
    },

    select: (
      el: T,
      label: string,
      property: PropPath<P>,
      options: ReadonlyArray<{ value: string; label: string }>,
      opts?: Partial<SelectCustomPropertyType>
    ): SelectCustomPropertyType => {
      const acc = new DynamicAccessor<P>();
      return {
        id: labelToId(label),
        type: 'select',
        label,
        options,
        isSet: acc.get(el.storedProps as P, property) !== undefined,
        get: () => acc.get(el.renderProps as P, property) as string,
        set: (value: string | undefined, uow: UnitOfWork) => {
          // @ts-expect-error
          el.updateProps(p => acc.set(p, property, value), uow);
        },
        ...opts
      };
    },

    icon: (el: T, label: string, property: PropPath<P>): IconCustomPropertyType => {
      const acc = new DynamicAccessor<P>();
      return {
        id: labelToId(label),
        type: 'icon',
        label,
        isSet: acc.get(el.storedProps as P, property) !== undefined,
        get: () => acc.get(el.renderProps as P, property) as string,
        set: (value: string | undefined, uow: UnitOfWork) => {
          // @ts-expect-error
          el.updateProps(p => acc.set(p, property, value), uow);
        }
      };
    },

    color: (el: T, label: string, property: PropPath<P>): ColorCustomPropertyType => {
      const acc = new DynamicAccessor<P>();
      return {
        id: labelToId(label),
        type: 'color',
        label,
        isSet: acc.get(el.storedProps as P, property) !== undefined,
        get: () => acc.get(el.renderProps as P, property) as string,
        set: (value: string | undefined, uow: UnitOfWork) => {
          // @ts-expect-error
          el.updateProps(p => acc.set(p, property, value), uow);
        }
      };
    },

    text: (
      el: T,
      label: string,
      property: PropPath<P>,
      opts?: Partial<TextCustomPropertyType>
    ): TextCustomPropertyType => {
      const acc = new DynamicAccessor<P>();
      return {
        id: labelToId(label),
        type: 'text',
        label,
        isSet: acc.get(el.storedProps as P, property) !== undefined,
        get: () => acc.get(el.renderProps as P, property) as string,
        set: (value: string | undefined, uow: UnitOfWork) => {
          // @ts-expect-error
          el.updateProps(p => acc.set(p, property, value), uow);
        },
        ...opts
      };
    },

    delimiter: (label: string) => ({ type: 'delimiter', label })
  };
};

export const CustomProperty = {
  node: makeCustomPropertyHelper<DiagramNode, NodeProps>(),
  edge: makeCustomPropertyHelper<DiagramEdge, EdgeProps>()
};

export type CustomPropertyDefinitionEntry =
  | DiagramCraft.CustomPropertyTypes[keyof DiagramCraft.CustomPropertyTypes]
  | { type: 'delimiter'; label: string };

export class CustomPropertyDefinition {
  private readonly arr: Array<CustomPropertyDefinitionEntry>;

  /**
   * This indicates schemas that cannot be removed from the nodes
   * and that will be displayed in a more prominent way.
   */
  dataSchemas: DataSchema[] = [];

  constructor(
    fn?: (
      p: (typeof CustomProperty)['node']
    ) => Array<CustomPropertyDefinitionEntry | CustomPropertyDefinition>
  ) {
    this.arr =
      fn?.(CustomProperty.node).flatMap(e =>
        e instanceof CustomPropertyDefinition ? e.entries : e
      ) ?? [];
  }

  get entries() {
    return this.arr;
  }
}

export const asProperty = (
  customProp: CustomPropertyType,
  change: (cb: (uow: UnitOfWork) => void) => void
): Property<unknown> => {
  if (!('get' in customProp) || !('set' in customProp)) throw new Error();
  return {
    val: customProp.get(),
    set: (v: unknown) => {
      change(uow => {
        // biome-ignore lint/suspicious/noExplicitAny: false positive
        customProp.set(v as any, uow);
      });
    },
    hasMultipleValues: false,
    isSet: customProp.isSet
  };
};
