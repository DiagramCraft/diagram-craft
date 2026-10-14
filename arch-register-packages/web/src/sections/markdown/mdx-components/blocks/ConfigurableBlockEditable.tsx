import type { TElement } from 'platejs';
import type { PlateElementProps } from 'platejs/react';
import { MdxComponentPreview } from '../MdxComponentPreview';
import { BaseBlockEditable } from './BaseBlockEditable';
import { MdxWidgetConfigDialog, type MdxConfigSpec } from './MdxWidgetConfigDialog';

type Props<E extends TElement, Config extends Record<string, unknown>> = PlateElementProps<E> & {
  /** The component's registered type, used to render the shared component as the preview. */
  componentType: string;
  placeholder: string;
  /** Stretches the preview to the full editor width. */
  fullWidth?: boolean;
  /** How the shared config form reads and writes this element. */
  configSpec: MdxConfigSpec<E, Config>;
  /** Whether the element is configured yet; an unconfigured one opens its dialog on insert. */
  hasValue: (element: E) => boolean;
  /** The authored attribute values handed to the shared component for the preview. */
  previewProps: (element: E) => Record<string, string>;
};

/**
 * Editor element for a block that is configured through its shared config form: a live preview of
 * the shared component with an edit button, and the config dialog.
 */
export const ConfigurableBlockEditable = <
  E extends TElement,
  Config extends Record<string, unknown>
>({
  element,
  children,
  componentType,
  placeholder,
  fullWidth,
  configSpec,
  hasValue,
  previewProps,
  ...props
}: Props<E, Config>) => {
  const configured = hasValue(element);

  return (
    <BaseBlockEditable
      element={element}
      hasValue={configured}
      fullWidth={fullWidth}
      placeholder={<span>{placeholder}</span>}
      content={<MdxComponentPreview type={componentType} props={previewProps(element)} />}
      dialog={(open, onClose) => (
        <MdxWidgetConfigDialog
          element={element}
          open={open}
          onClose={onClose}
          isNew={!configured}
          spec={configSpec}
        />
      )}
      {...props}
    >
      {children}
    </BaseBlockEditable>
  );
};
