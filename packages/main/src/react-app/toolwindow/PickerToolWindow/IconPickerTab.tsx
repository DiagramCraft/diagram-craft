import { useCallback, useEffect, useRef, useState } from 'react';
import { Accordion } from '@diagram-craft/app-components/Accordion';
import { Collapsible } from '@diagram-craft/app-components/Collapsible';
import { TextInput } from '@diagram-craft/app-components/TextInput';
import { Button } from '@diagram-craft/app-components/Button';
import { TbSearch } from 'react-icons/tb';
import { ToolWindow } from '../ToolWindow';
import { ToolWindowPanel } from '../ToolWindowPanel';
import { IconifyIconService } from '@diagram-craft/canvas-app/icon/IconifyIconService';
import type {
  CollectionIcons,
  CollectionInfo,
  IconService
} from '@diagram-craft/canvas-app/icon/IconService';
import { isEmptyString } from '@diagram-craft/utils/strings';
import styles from './IconPickerTab.module.css';

const service: IconService = new IconifyIconService();

const PAGE_SIZE = 30;
const SEARCH_PAGE_SIZE = 60;

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

const IconGrid = (props: { icons: string[]; getUrl: (icon: string) => string }) => (
  <div className={'cmp-object-picker'}>
    {props.icons.map(icon => (
      <img
        key={icon}
        className={styles.iconItem}
        loading="lazy"
        src={props.getUrl(icon)}
        width={35}
        height={35}
        title={icon}
      />
    ))}
  </div>
);

const Pagination = (props: {
  page: number;
  totalPages: number;
  onPrev: () => void;
  onNext: () => void;
}) => {
  if (props.totalPages <= 1) return null;
  return (
    <div className={styles.pagination}>
      <button
        type="button"
        className={styles.paginationBtn}
        disabled={props.page === 0}
        onClick={props.onPrev}
      >
        ‹ Prev
      </button>
      <span>
        {props.page + 1} / {props.totalPages}
      </span>
      <button
        type="button"
        className={styles.paginationBtn}
        disabled={props.page >= props.totalPages - 1}
        onClick={props.onNext}
      >
        Next ›
      </button>
    </div>
  );
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

  useEffect(() => {
    setPage(0);
  }, [cachedData]);

  if (!cachedData) return <div className={styles.loading}>Loading...</div>;

  const allIcons = flattenIcons(cachedData);
  const totalPages = Math.ceil(allIcons.length / PAGE_SIZE);
  const pageIcons = allIcons.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  return (
    <>
      <Pagination
        page={page}
        totalPages={totalPages}
        onPrev={() => setPage(p => p - 1)}
        onNext={() => setPage(p => p + 1)}
      />
      <IconGrid icons={pageIcons} getUrl={icon => service.getIconUrl(prefix, icon)} />
    </>
  );
};

const SearchResultsPanel = (props: { service: IconService; icons: string[] }) => {
  const [page, setPage] = useState(0);

  useEffect(() => {
    setPage(0);
  }, [props.icons]);

  const totalPages = Math.ceil(props.icons.length / SEARCH_PAGE_SIZE);
  const pageIcons = props.icons.slice(page * SEARCH_PAGE_SIZE, (page + 1) * SEARCH_PAGE_SIZE);

  const getUrl = (icon: string) => {
    const [prefix, name] = icon.split(':');
    return props.service.getIconUrl(prefix!, name!);
  };

  return (
    <>
      <Pagination
        page={page}
        totalPages={totalPages}
        onPrev={() => setPage(p => p - 1)}
        onNext={() => setPage(p => p + 1)}
      />
      <IconGrid icons={pageIcons} getUrl={getUrl} />
    </>
  );
};

export const IconPickerTab = () => {
  const [collections, setCollections] = useState<Record<string, CollectionInfo> | null>(null);
  const [openCategories, setOpenCategories] = useState<string[]>([]);
  const [loadedIcons, setLoadedIcons] = useState<Map<string, CollectionIcons>>(new Map());
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<string[]>([]);
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    service.getCollections().then(data => setCollections(data));
  }, []);

  const doSearch = useCallback((query: string) => {
    setSearchQuery(query);
    if (isEmptyString(query)) {
      setSearchResults([]);
    } else {
      service.searchIcons(query).then(r => setSearchResults(r.icons));
    }
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
      <ToolWindowPanel mode={'headless'} id={'icon-search'} title={'Search'}>
        <div className={'util-hstack'}>
          <TextInput
            ref={ref}
            value={searchQuery}
            style={{ flexGrow: 1 }}
            onKeyDown={e => {
              if (e.key === 'Enter') {
                doSearch(e.currentTarget.value);
              } else if (e.key === 'Escape') {
                e.preventDefault();
                e.stopPropagation();
                doSearch('');
                setTimeout(() => {
                  if (ref.current) ref.current.value = '';
                }, 0);
              }
            }}
            onClear={() => doSearch('')}
          />
          <Button type={'secondary'} onClick={() => doSearch(ref.current?.value ?? '')}>
            <TbSearch />
          </Button>
        </div>
      </ToolWindowPanel>

      {!isEmptyString(searchQuery) ? (
        <div style={{ marginTop: '0.75rem', marginLeft: '0.5rem', marginRight: '0.5rem' }}>
          <SearchResultsPanel service={service} icons={searchResults} />
        </div>
      ) : (
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
      )}
    </ToolWindow.TabContent>
  );
};
