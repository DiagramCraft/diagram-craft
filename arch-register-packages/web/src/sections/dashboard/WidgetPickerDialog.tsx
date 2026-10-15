import { useMemo, useState } from 'react';
import { Dialog } from '@diagram-craft/app-components/Dialog';
import type { DashboardWidget } from '@arch-register/api-types/dashboardContract';
import { useSavedViews } from '../../hooks/useSavedViews';
import { useMdxContext } from '../markdown/MdxContext';
import { createDefaultWidget } from './dashboardWidgets';
import type { WidgetSurface } from '../markdown/mdx-components/types';
import { getComponentDefinitions } from '../markdown/mdx-components/componentRegistry';
import {
  COMPONENT_CATEGORIES,
  type ComponentCategory,
  matchesCatalogSearch
} from '../markdown/mdx-components/componentCategories';
import { WikiPagePicker } from './widgets/WikiPagePicker';
import styles from './WidgetPickerDialog.module.css';

type Props = {
  open: boolean;
  onClose: () => void;
  workspaceSlug: string;
  surface?: WidgetSurface;
  widgets: DashboardWidget[];
  onAdd: (widget: DashboardWidget) => void;
  /** Widget types that must not be offered (e.g. `tabs` inside a tab). */
  exclude?: string[];
};

export const WidgetPickerDialog = ({
  open,
  onClose,
  workspaceSlug,
  surface = 'workspace',
  widgets,
  onAdd,
  exclude = []
}: Props) => {
  const [pendingType, setPendingType] = useState<string | null>(null);
  const [selectedViewId, setSelectedViewId] = useState('');
  const [selectedWikiPageId, setSelectedWikiPageId] = useState('');
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState<ComponentCategory | 'all'>('all');

  const { projectId } = useMdxContext();
  const { data: savedViews = [] } = useSavedViews(workspaceSlug, {
    projectId,
    includeWorkspace: true
  });
  const matching = useMemo(
    () =>
      getComponentDefinitions('dashboardWidget')
        .map(({ type, category, name, description, keywords, dashboardWidget: spec }) => ({
          type,
          category,
          spec,
          label: name,
          description,
          keywords
        }))
        .filter(
          widget =>
            widget.spec.surfaces.includes(surface) &&
            !exclude.includes(widget.type) &&
            matchesCatalogSearch(search, widget)
        )
        .sort((a, b) => a.label.localeCompare(b.label)),
    [surface, exclude, search]
  );
  const countByCategory = (category: ComponentCategory) =>
    matching.filter(widget => widget.category === category).length;
  const availableCategories = COMPONENT_CATEGORIES.filter(category =>
    matching.some(widget => widget.category === category.id)
  );
  const visible =
    activeCategory === 'all'
      ? matching
      : matching.filter(widget => widget.category === activeCategory);

  const handleClose = () => {
    setPendingType(null);
    setSelectedViewId('');
    setSelectedWikiPageId('');
    setSearch('');
    setActiveCategory('all');
    onClose();
  };

  const handlePick = (type: string) => {
    if (type === 'EntityViewEmbed') {
      setPendingType(type);
      return;
    }
    if (type === 'wiki-page') {
      setPendingType(type);
      return;
    }
    onAdd(createDefaultWidget(type, widgets));
    handleClose();
  };

  const handleConfirmSavedView = () => {
    if (!selectedViewId) return;
    onAdd(createDefaultWidget('EntityViewEmbed', widgets, selectedViewId));
    handleClose();
  };

  const handleConfirmWikiPage = () => {
    if (!selectedWikiPageId) return;
    onAdd({
      ...createDefaultWidget('wiki-page', widgets),
      config: { nodeId: selectedWikiPageId }
    });
    handleClose();
  };

  const isSelectingWikiPage = pendingType === 'wiki-page';

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      title="Add widget"
      width={pendingType ? 420 : 860}
      buttons={
        pendingType === 'EntityViewEmbed' || isSelectingWikiPage
          ? [
              { label: 'Cancel', type: 'cancel', onClick: handleClose },
              {
                label: 'Add',
                type: 'default',
                disabled: isSelectingWikiPage ? !selectedWikiPageId : !selectedViewId,
                onClick: isSelectingWikiPage ? handleConfirmWikiPage : handleConfirmSavedView
              }
            ]
          : [{ label: 'Cancel', type: 'cancel', onClick: handleClose }]
      }
    >
      {pendingType === 'EntityViewEmbed' ? (
        <div className={styles.viewPicker}>
          <select
            className={styles.viewSelect}
            value={selectedViewId}
            onChange={e => setSelectedViewId(e.target.value)}
          >
            <option value="">Select a saved view…</option>
            {savedViews.map(view => (
              <option key={view.id} value={view.id}>
                {view.name}
              </option>
            ))}
          </select>
        </div>
      ) : isSelectingWikiPage ? (
        <div className={styles.viewPicker}>
          <WikiPagePicker
            workspaceSlug={workspaceSlug}
            projectId={projectId}
            surface={surface}
            value={selectedWikiPageId}
            onChange={setSelectedWikiPageId}
          />
        </div>
      ) : (
        <div className={styles.picker}>
          <nav className={styles.sidebar} aria-label="Widget categories">
            <button
              type="button"
              className={`${styles.category} ${activeCategory === 'all' ? styles.categoryActive : ''}`}
              onClick={() => setActiveCategory('all')}
            >
              All <span className={styles.count}>{matching.length}</span>
            </button>
            {availableCategories.map(category => (
              <button
                key={category.id}
                type="button"
                title={category.description}
                className={`${styles.category} ${
                  activeCategory === category.id ? styles.categoryActive : ''
                }`}
                onClick={() => setActiveCategory(category.id)}
              >
                {category.label}{' '}
                <span className={styles.count}>{countByCategory(category.id)}</span>
              </button>
            ))}
          </nav>
          <div className={styles.main}>
            <input
              type="search"
              className={styles.search}
              placeholder="Search widgets…"
              aria-label="Search widgets"
              value={search}
              onChange={e => setSearch(e.target.value)}
              autoFocus
            />
            <div className={styles.grid}>
              {visible.length === 0 && (
                <div className={styles.empty}>No widgets match your search</div>
              )}
              {visible.map(({ type, label, description }) => (
                <button
                  key={type}
                  type="button"
                  className={styles.option}
                  onClick={() => handlePick(type)}
                >
                  <span className={styles.optionLabel}>{label}</span>
                  <span className={styles.optionDescription}>{description}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </Dialog>
  );
};
