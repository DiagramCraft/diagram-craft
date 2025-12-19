import { useApplication, useDiagram } from '../../../application';
import { useRedraw } from '../../hooks/useRedraw';
import { useEventListener } from '../../hooks/useEventListener';
import { useCallback, useEffect, useRef, useState } from 'react';
import { StylesPanel, TextStylesPanel } from './StylesPanel';
import { ToolWindow } from '../ToolWindow';
import {
  collectStyles,
  collectTextStyles,
  extractPropsToConsider,
  type StyleCombination,
  type StyleFilterType,
  type StylesheetGroup,
  type TextStyleCombination
} from './stylesPanelUtils';
import { debounce } from '@diagram-craft/utils/debounce';
import { UnitOfWork } from '@diagram-craft/model/unitOfWork';
import { commitWithUndo, SnapshotUndoableAction } from '@diagram-craft/model/diagramUndoActions';
import type { DiagramElement } from '@diagram-craft/model/diagramElement';
import { isNode } from '@diagram-craft/model/diagramElement';
import type { ElementProps } from '@diagram-craft/model/diagramProps';
import { DynamicAccessor } from '@diagram-craft/utils/propertyPath';
import { StringInputDialogCommand } from '@diagram-craft/canvas-app/dialogs';
import { AddStylesheetUndoableAction, Stylesheet } from '@diagram-craft/model/diagramStyles';
import { CompoundUndoableAction } from '@diagram-craft/model/undoManager';
import { newid } from '@diagram-craft/utils/id';
import { deepMerge } from '@diagram-craft/utils/object';
import { edgeDefaults, nodeDefaults } from '@diagram-craft/model/diagramDefaults';
import { mustExist } from '@diagram-craft/utils/assert';

export const StylesTab = () => {
  const diagram = useDiagram();
  const application = useApplication();
  const redraw = useRedraw();
  const redrawDebounce = debounce(redraw, 200);

  const [filterType, setFilterType] = useState<StyleFilterType>('all');

  // Track if selection change is from clicking in this panel
  const isInternalSelectionRef = useRef(false);

  const [visualGroups, setVisualGroups] = useState<StylesheetGroup<StyleCombination>[]>([]);
  const [textGroups, setTextGroups] = useState<StylesheetGroup<TextStyleCombination>[]>([]);

  const recalculateGroups = useCallback(() => {
    const selectedElements = diagram.selection.elements;
    const elements = [...(selectedElements.length > 0 ? selectedElements : diagram.allElements())];

    if (filterType !== 'text') {
      const visualGroups = collectStyles(diagram, elements, filterType);
      setVisualGroups(visualGroups);
    }

    if (filterType === 'text') {
      const textGroups = collectTextStyles(diagram, elements);
      setTextGroups(textGroups);
    }
  }, [diagram, filterType]);

  useEffect(() => recalculateGroups(), [recalculateGroups]);

  // Element changes should always update the cache
  const handleElementChange = useCallback(() => {
    recalculateGroups();
    redrawDebounce();
  }, [recalculateGroups, redrawDebounce]);

  // Handle selection changes - only update cache for external changes
  const handleSelectionChange = useCallback(() => {
    if (isInternalSelectionRef.current) {
      // Internal selection - don't update cache, just redraw
      isInternalSelectionRef.current = false;
      redraw();
    } else {
      handleElementChange();
    }
  }, [redraw, handleElementChange]);

  useEventListener(diagram, 'elementChange', handleElementChange);
  useEventListener(diagram, 'elementAdd', handleElementChange);
  useEventListener(diagram, 'elementRemove', handleElementChange);
  useEventListener(diagram, 'diagramChange', handleElementChange);
  useEventListener(diagram.document, 'diagramChanged', handleElementChange);

  useEventListener(diagram.selection, 'change', handleSelectionChange);

  const handleStyleClick = useCallback(
    (combo: StyleCombination | TextStyleCombination) => {
      isInternalSelectionRef.current = true;

      diagram.selection.setElements(combo.elements);
    },
    [diagram]
  );

  const handleStyleReset = useCallback(
    (elements: DiagramElement[], differences: Partial<ElementProps>) => {
      const uow = new UnitOfWork(diagram, true);

      const accessor = new DynamicAccessor<ElementProps>();
      const paths = accessor.paths(differences);

      // Sort paths by length, longest first
      paths.sort((a, b) => b.length - a.length);

      for (const element of elements) {
        element.updateProps(props => {
          for (const path of paths) {
            accessor.set(props, path, undefined);
          }
        }, uow);
      }

      commitWithUndo(uow, 'Reset styles');
    },
    [diagram]
  );

  const handleCreateStylesheet = useCallback(
    (combo: StyleCombination | TextStyleCombination) => {
      application.ui.showDialog(
        new StringInputDialogCommand(
          {
            label: 'Name',
            title: 'New stylesheet',
            saveButtonLabel: 'Create',
            value: ''
          },
          name => {
            const id = newid();
            const isTextStyle = filterType === 'text';
            const isNodeStyle = combo.elements.every(isNode);

            // Determine stylesheet type
            const type = isTextStyle ? 'text' : isNodeStyle ? 'node' : 'edge';

            // Get base stylesheet props
            // biome-ignore lint/suspicious/noExplicitAny: Type merging across different prop types
            const baseProps = (combo.stylesheet?.props ?? {}) as any;

            // Merge base props with differences to create the new stylesheet props
            // biome-ignore lint/suspicious/noExplicitAny: Type merging across different prop types
            const newProps = deepMerge({}, baseProps, combo.propsDifferences as any);

            // Create the new stylesheet
            const stylesheet = Stylesheet.fromSnapshot(
              type,
              {
                id,
                name,
                props: newProps
              },
              diagram.document.styles.crdt.factory
            );

            const uow = new UnitOfWork(diagram, true);

            // Add stylesheet to document
            diagram.document.styles.addStylesheet(id, stylesheet, uow);

            // Set the stylesheet on all matching elements
            for (const element of combo.elements) {
              diagram.document.styles.setStylesheet(element, id, uow, true);
            }

            const snapshots = uow.commit();
            diagram.undoManager.add(
              new CompoundUndoableAction([
                new AddStylesheetUndoableAction(diagram, stylesheet),
                new SnapshotUndoableAction('Create stylesheet', diagram, snapshots)
              ])
            );
          }
        )
      );
    },
    [diagram, application, filterType]
  );

  const handleCopyStyle = useCallback(
    (combo: StyleCombination | TextStyleCombination) => {
      const isNodeStyle = combo.elements.every(isNode);

      const defaultProps = (isNodeStyle ? nodeDefaults : edgeDefaults).applyDefaults(
        combo.stylesheet?.props ?? {}
      );

      const props = extractPropsToConsider(
        deepMerge({}, defaultProps as any, combo.props as any),
        filterType,
        isNodeStyle
      );

      mustExist(application.actions['STYLE_COPY']).execute({
        props,
        type: isNodeStyle ? 'node' : 'edge'
      });
    },
    [application, filterType]
  );

  const handlePasteStyle = useCallback(
    (combo: StyleCombination | TextStyleCombination) => {
      application.actions.STYLE_PASTE?.execute({
        elements: combo.elements
      });
    },
    [diagram, application]
  );

  return (
    <ToolWindow.TabContent>
      {filterType === 'text' ? (
        <TextStylesPanel
          groups={textGroups}
          onStyleClick={handleStyleClick}
          onStyleReset={handleStyleReset}
          onCreateStylesheet={handleCreateStylesheet}
          onCopyStyle={handleCopyStyle}
          onPasteStyle={handlePasteStyle}
          filterType={filterType}
          onFilterTypeChange={setFilterType}
        />
      ) : (
        <StylesPanel
          groups={visualGroups}
          onStyleClick={handleStyleClick}
          onStyleReset={handleStyleReset}
          onCreateStylesheet={handleCreateStylesheet}
          onCopyStyle={handleCopyStyle}
          onPasteStyle={handlePasteStyle}
          filterType={filterType}
          onFilterTypeChange={setFilterType}
        />
      )}
    </ToolWindow.TabContent>
  );
};
