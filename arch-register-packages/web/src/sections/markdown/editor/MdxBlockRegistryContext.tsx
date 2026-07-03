import { createContext, useContext } from 'react';
import type { MdxComponentSpec } from '../mdx-components/types';

/**
 * Exposes the MDX component registry to deeply-nested editor chrome (e.g.
 * EditorBlock's context menu) without those files statically importing
 * mdxRegistry.tsx directly — mdxRegistry.tsx transitively imports EditorBlock.tsx
 * through the block Editable components it registers, so a direct import back
 * would form a circular import.
 */
const MdxBlockRegistryContext = createContext<Record<string, MdxComponentSpec> | undefined>(
  undefined
);

export const MdxBlockRegistryProvider = MdxBlockRegistryContext.Provider;

export const useMdxBlockRegistry = (): Record<string, MdxComponentSpec> =>
  useContext(MdxBlockRegistryContext) ?? {};
