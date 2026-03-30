import { useDiagram } from '../../../application';
import { useRedraw } from '../../hooks/useRedraw';
import { useEventListener } from '../../hooks/useEventListener';
import { ToolWindow } from '../ToolWindow';
import { Select } from '@diagram-craft/app-components/Select';
import { applyVariantToDocument } from '@diagram-craft/model/stencilUtils';
import { UnitOfWork } from '@diagram-craft/model/unitOfWork';
import type { StencilStyleVariant } from '@diagram-craft/model/stencilRegistry';
import type { StencilPackage } from '@diagram-craft/model/stencilRegistry';
import type { DiagramStyles } from '@diagram-craft/model/diagramStyles';
import { deepEquals } from '@diagram-craft/utils/object';
import styles from './StyleVariantsTab.module.css';

/** Returns the variant whose props exactly match the document's current stylesheet props, or undefined. */
const detectActiveVariant = (
  styleVariants: StencilStyleVariant[],
  documentStyles: DiagramStyles
): string | undefined => {
  for (const variant of styleVariants) {
    const allMatch = variant.styles.every(variantStyle => {
      const docStyle = documentStyles.get(variantStyle.id);
      if (!docStyle) return false;
      return deepEquals(docStyle.props, variantStyle.props);
    });
    if (allMatch) return variant.id;
  }
  return undefined;
};

/** Returns true when at least one style ID from any variant is present in the document. */
const isPackageUsedInDocument = (
  pkg: StencilPackage,
  documentStyles: DiagramStyles
): boolean => {
  if (!pkg.styleVariants || pkg.styleVariants.length === 0) return false;
  return pkg.styleVariants.some(v => v.styles.some(s => documentStyles.get(s.id) !== undefined));
};

type VariantRowProps = {
  pkg: StencilPackage;
  activeVariantId: string | undefined;
  onSelect: (variant: StencilStyleVariant) => void;
};

const VariantRow = ({ pkg, activeVariantId, onSelect }: VariantRowProps) => {
  const variants = pkg.styleVariants!;

  return (
    <div className={styles.eRow}>
      <span className={styles.ePackageName}>{pkg.name ?? pkg.id}</span>
      <Select.Root
        value={activeVariantId}
        onChange={id => {
          const variant = variants.find(v => v.id === id);
          if (variant) onSelect(variant);
        }}
        placeholder={'Custom'}
      >
        {variants.map(v => (
          <Select.Item key={v.id} value={v.id}>
            {v.name}
          </Select.Item>
        ))}
      </Select.Root>
    </div>
  );
};

export const StyleVariantsTab = () => {
  const diagram = useDiagram();
  const redraw = useRedraw();

  useEventListener(diagram, 'diagramChange', redraw);
  useEventListener(diagram.document, 'diagramChanged', redraw);
  useEventListener(diagram.document.styles, 'stylesheetAdded', redraw);
  useEventListener(diagram.document.styles, 'stylesheetUpdated', redraw);
  useEventListener(diagram.document.styles, 'stylesheetRemoved', redraw);
  useEventListener(diagram.document.registry.stencils, 'change', redraw);

  // Computed inline — no useMemo, because the deps (document.styles, registry.stencils)
  // are stable object references that never get replaced, so useMemo would never recompute
  // after the initial render even when their contents change.
  const activePackages = diagram.document.registry.stencils
    .getStencils()
    .filter(pkg => isPackageUsedInDocument(pkg, diagram.document.styles));

  const handleSelect = (variant: StencilStyleVariant) => {
    UnitOfWork.executeWithUndo(diagram, `Apply variant "${variant.name}"`, uow => {
      applyVariantToDocument(variant, diagram.document, uow);
      diagram.elements.forEach(el => el.clearCache());
    });
  };

  return (
    <ToolWindow.TabContent>
      <div className={styles.icStyleVariantsTab}>
        {activePackages.length === 0 ? (
          <div className={styles.eEmpty}>
            No style variants are used in this document.
          </div>
        ) : (
          <div className={styles.eList}>
            {activePackages.map(pkg => (
              <VariantRow
                key={pkg.id}
                pkg={pkg}
                activeVariantId={detectActiveVariant(pkg.styleVariants!, diagram.document.styles)}
                onSelect={handleSelect}
              />
            ))}
          </div>
        )}
      </div>
    </ToolWindow.TabContent>
  );
};
