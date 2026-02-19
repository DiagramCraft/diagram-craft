import { useEffect, useState } from 'react';
import { Accordion } from '@diagram-craft/app-components/Accordion';
import { Collapsible } from '@diagram-craft/app-components/Collapsible';
import { ToolWindow } from '../ToolWindow';
import { IconifyIconService } from '@diagram-craft/canvas-app/icon/IconifyIconService';
import type {
  CollectionIcons,
  CollectionInfo,
  IconService
} from '@diagram-craft/canvas-app/icon/IconService';
import styles from './IconPickerTab.module.css';

const service: IconService = new IconifyIconService();

const PAGE_SIZE = 30;

const flattenIcons = (data: CollectionIcons): string[] => {
  const entries: string[] = [];
  if (data.categories) {
    for (const icons of Object.values(data.categories)) {
      entries.push(...icons);
    }
  }
  if (data.uncategorized) {
    entries.push(...data.uncategorized);
  }
  return entries;
};

type CollectionIconsProps = {
  service: IconService;
  prefix: string;
  cachedData: CollectionIcons | undefined;
  onLoad: (prefix: string, data: CollectionIcons) => void;
};

const CollectionIconsPanel = (props: CollectionIconsProps) => {
  const { service, prefix, cachedData, onLoad } = props;
  const [page, setPage] = useState(0);

  useEffect(() => {
    if (!cachedData) {
      service.getCollectionIcons(prefix).then(data => onLoad(prefix, data));
    }
  }, [cachedData, prefix, service, onLoad]);

  // Reset to first page whenever the collection data changes
  useEffect(() => {
    setPage(0);
  }, [cachedData]);

  if (!cachedData) return <div className={styles.loading}>Loading...</div>;

  const allIcons = flattenIcons(cachedData);
  const totalPages = Math.ceil(allIcons.length / PAGE_SIZE);
  const pageIcons = allIcons.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  return (
    <>
      <div className={'cmp-object-picker'}>
        {pageIcons.map(icon => (
          <img
            key={icon}
            className={styles.iconItem}
            loading="lazy"
            src={service.getIconUrl(prefix, icon)}
            width={35}
            height={35}
            title={icon}
          />
        ))}
      </div>
      {totalPages > 1 && (
        <div className={styles.pagination}>
          <button
            type="button"
            className={styles.paginationBtn}
            disabled={page === 0}
            onClick={() => setPage(p => p - 1)}
          >
            ‹ Prev
          </button>
          <span>
            {page + 1} / {totalPages}
          </span>
          <button
            type="button"
            className={styles.paginationBtn}
            disabled={page >= totalPages - 1}
            onClick={() => setPage(p => p + 1)}
          >
            Next ›
          </button>
        </div>
      )}
    </>
  );
};

export const IconPickerTab = () => {
  const [collections, setCollections] = useState<Record<string, CollectionInfo> | null>(null);
  const [openCategories, setOpenCategories] = useState<string[]>([]);
  const [loadedIcons, setLoadedIcons] = useState<Map<string, CollectionIcons>>(new Map());

  useEffect(() => {
    service.getCollections().then(data => setCollections(data));
  }, []);

  if (!collections) {
    return (
      <ToolWindow.TabContent>
        <div className={styles.loading}>Loading collections...</div>
      </ToolWindow.TabContent>
    );
  }

  // Group collections by category
  const byCategory = new Map<string, Array<[string, CollectionInfo]>>();
  for (const [prefix, info] of Object.entries(collections)) {
    const cat = info.category ?? 'Other';
    if (!byCategory.has(cat)) byCategory.set(cat, []);
    byCategory.get(cat)!.push([prefix, info]);
  }

  const handleIconLoad = (prefix: string, data: CollectionIcons) => {
    setLoadedIcons(prev => new Map(prev).set(prefix, data));
  };

  return (
    <ToolWindow.TabContent>
      <Accordion.Root type="multiple" value={openCategories} onValueChange={setOpenCategories}>
        {[...byCategory.entries()]
          .toSorted(([a], [b]) => a.localeCompare(b))
          .map(([category, entries]) => (
            <Accordion.Item key={category} value={category}>
              <Accordion.ItemHeader>{category}</Accordion.ItemHeader>
              <Accordion.ItemContent forceMount={false}>
                <div className={styles.collectionList}>
                  {entries
                    .toSorted(([, a], [, b]) => a.name.localeCompare(b.name))
                    .map(([prefix, info]) => (
                      <Collapsible key={prefix} label={info.name}>
                        <CollectionIconsPanel
                          service={service}
                          prefix={prefix}
                          cachedData={loadedIcons.get(prefix)}
                          onLoad={handleIconLoad}
                        />
                      </Collapsible>
                    ))}
                </div>
              </Accordion.ItemContent>
            </Accordion.Item>
          ))}
      </Accordion.Root>
    </ToolWindow.TabContent>
  );
};
