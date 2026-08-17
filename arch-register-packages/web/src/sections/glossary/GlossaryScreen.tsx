import { useMemo, useRef } from 'react';
import { getRouteApi } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { TbFilter, TbX } from 'react-icons/tb';
import { Button } from '@diagram-craft/app-components/Button';
import { Popover, type PopoverActions } from '@diagram-craft/app-components/Popover';
import { Title } from '../../components/Title';
import { SearchInput } from '../../components/SearchInput';
import { FilterDropdown } from '../../components/FilterDropdown';
import { Chip } from '../../components/Chip';
import { StatusChip } from '../../components/StatusChip';
import { Table } from '../../components/table/Table';
import { useTableSort } from '../../components/table/useTableSort';
import { schemaColor } from '../../lib/schemaPresentation';
import { useTeams, useLifecycleStates } from '../../hooks/useWorkspaceConfig';
import { glossaryConfigQuery, glossaryTermsQuery } from '../../queries/glossary';
import { entitiesQuery } from '../../queries/entities';
import type { GlossaryTerm } from '@arch-register/api-types/glossaryContract';
import { GlossaryQualityBadges } from './GlossaryQualityBadges';
import filterStyles from '../entities/components/EntityBrowser.module.css';
import styles from './GlossaryScreen.module.css';

const routeApi = getRouteApi('/authenticated/$workspaceSlug/glossary');

type SortKey = 'name' | 'usage' | 'status';

const compareNullable = (a: string | null | undefined, b: string | null | undefined): number => {
  if (!a && !b) return 0;
  if (!a) return 1;
  if (!b) return -1;
  return a.localeCompare(b);
};

export const GlossaryScreen = () => {
  const { workspaceSlug } = routeApi.useParams();
  const navigate = routeApi.useNavigate();
  const search = routeApi.useSearch();
  const q = search.q ?? '';
  const categoryIds = useMemo(
    () => (search.categoryIds ?? '').split(',').filter(Boolean),
    [search.categoryIds]
  );
  const filterPopoverRef = useRef<PopoverActions | null>(null);

  const config = useQuery(glossaryConfigQuery(workspaceSlug));
  const categories = useQuery(
    entitiesQuery(
      workspaceSlug,
      { schemaId: config.data?.categorySchemaId, view: 'summary', limit: 100 },
      config.data != null
    )
  );
  const { data: owners = [] } = useTeams(workspaceSlug);
  const { data: lifecycleStates = [] } = useLifecycleStates(workspaceSlug);
  const terms = useQuery(
    glossaryTermsQuery(workspaceSlug, {
      q: q.trim() || undefined,
      quality: search.quality,
      categoryIds: categoryIds.length > 0 ? categoryIds : undefined,
      owner: search.owner,
      lifecycle: search.lifecycle,
      limit: 200
    })
  );
  const items = terms.data?.items ?? [];

  const categoryById = useMemo(() => {
    const map = new Map<string, { name: string; color: string }>();
    (categories.data?.items ?? []).forEach((category, index) => {
      map.set(category._uid, { name: category._name, color: schemaColor(index) });
    });
    return map;
  }, [categories.data]);

  const comparators: Record<SortKey, (a: GlossaryTerm, b: GlossaryTerm) => number> = {
    name: (a, b) => a.canonicalName.localeCompare(b.canonicalName),
    usage: (a, b) => b.usageCount - a.usageCount,
    status: (a, b) => compareNullable(a.status, b.status)
  };
  const { sorted, sort, toggleSort } = useTableSort<GlossaryTerm, SortKey>(items, comparators, {
    key: 'name',
    dir: 'asc'
  });

  const patchSearch = (patch: Record<string, unknown>) =>
    navigate({ search: previous => ({ ...previous, ...patch }) });

  const activeOwnerLifecycleCount = (search.owner ? 1 : 0) + (search.lifecycle ? 1 : 0);

  const clearAll = () =>
    navigate({
      search: () => ({})
    });

  const removeCategory = (id: string) =>
    patchSearch({
      categoryIds: categoryIds.filter(current => current !== id).join(',') || undefined
    });

  if (config.isLoading) return <div className={styles.empty}>Loading glossary…</div>;
  if (!config.data) {
    return <div className={styles.empty}>The business glossary is not enabled.</div>;
  }

  const chips: { key: string; label: string; value: string; onRemove: () => void }[] = [];
  if (q) chips.push({ key: 'q', label: 'Search', value: q, onRemove: () => patchSearch({ q: undefined }) });
  categoryIds.forEach(id => {
    const category = categoryById.get(id);
    if (category) {
      chips.push({
        key: `cat-${id}`,
        label: 'Category',
        value: category.name,
        onRemove: () => removeCategory(id)
      });
    }
  });
  if (search.quality) {
    chips.push({
      key: 'quality',
      label: 'Quality',
      value: search.quality,
      onRemove: () => patchSearch({ quality: undefined })
    });
  }
  if (search.owner) {
    chips.push({
      key: 'owner',
      label: 'Owner',
      value: owners.find(owner => owner.id === search.owner)?.name ?? search.owner,
      onRemove: () => patchSearch({ owner: undefined })
    });
  }
  if (search.lifecycle) {
    chips.push({
      key: 'lifecycle',
      label: 'Lifecycle',
      value: lifecycleStates.find(state => state.id === search.lifecycle)?.label ?? search.lifecycle,
      onRemove: () => patchSearch({ lifecycle: undefined })
    });
  }

  return (
    <main className={styles.screen}>
      <div className={styles.header}>
        <Title
          title="Business glossary"
          chips={
            !terms.isLoading && <span className={styles.count}>{terms.data?.total ?? 0}</span>
          }
          description="Find governed terms by canonical name, synonym, or abbreviation. Creation and editing happen in Entities."
        />
      </div>

      <div className={filterStyles.toolbar}>
        <SearchInput
          size="sm"
          className={filterStyles.searchInline}
          value={q}
          placeholder="Search by name, synonym, or abbreviation…"
          aria-label="Search glossary"
          onChange={value => patchSearch({ q: value || undefined })}
          onClear={() => patchSearch({ q: undefined })}
        />
        <Popover.Root actionsRef={filterPopoverRef}>
          <Popover.Trigger
            element={
              <Button
                size="sm"
                variant={activeOwnerLifecycleCount > 0 ? 'primary' : 'secondary'}
                icon={<TbFilter size={12} />}
              >
                Owner / Lifecycle
                {activeOwnerLifecycleCount > 0 && (
                  <span className={filterStyles.filterCount}>{activeOwnerLifecycleCount}</span>
                )}
              </Button>
            }
          />
          <Popover.Content
            sideOffset={4}
            align="start"
            arrow={false}
            closeButton={false}
            className={filterStyles.filterPopover}
          >
            <div className={styles.ownerPopover}>
              <div className={styles.pillGroupLabel}>Owner</div>
              <div className={styles.pillRow}>
                {owners.map(owner => (
                  <button
                    key={owner.id}
                    type="button"
                    className={`${styles.pill} ${search.owner === owner.id ? styles.pillActive : ''}`}
                    onClick={() =>
                      patchSearch({ owner: search.owner === owner.id ? undefined : owner.id })
                    }
                  >
                    {owner.name}
                  </button>
                ))}
                {owners.length === 0 && <span className="dim">No owners configured.</span>}
              </div>
              <div className={styles.pillGroupLabel}>Lifecycle</div>
              <div className={styles.pillRow}>
                {lifecycleStates.map(state => (
                  <button
                    key={state.id}
                    type="button"
                    className={`${styles.pill} ${search.lifecycle === state.id ? styles.pillActive : ''}`}
                    onClick={() =>
                      patchSearch({ lifecycle: search.lifecycle === state.id ? undefined : state.id })
                    }
                  >
                    {state.label}
                  </button>
                ))}
              </div>
            </div>
          </Popover.Content>
        </Popover.Root>
        <div style={{ marginLeft: 'auto' }}>
          <FilterDropdown
            label="Sort"
            value={sort?.key ?? 'name'}
            onChange={value =>
              value !== sort?.key && toggleSort(value as SortKey)
            }
            options={[
              { value: 'name', label: 'Name' },
              { value: 'usage', label: 'Usage' },
              { value: 'status', label: 'Status' }
            ]}
          />
        </div>
      </div>

      {chips.length > 0 && (
        <div className={styles.activeFilters}>
          {chips.map(chip => (
            <span key={chip.key} className={styles.activeChip}>
              <span className={styles.activeChipLabel}>{chip.label}</span>
              <span>{chip.value}</span>
              <button
                type="button"
                className={styles.activeChipRemove}
                onClick={chip.onRemove}
                title={`Remove ${chip.label}`}
              >
                <TbX size={10} />
              </button>
            </span>
          ))}
          <Button variant="ghost" onClick={clearAll}>
            Clear all
          </Button>
        </div>
      )}

      <Table.Root scroll stickyHeader>
        <Table.Head>
          <Table.Row>
            <Table.SortableHeaderCell sortKey="name" sort={sort} onSort={toggleSort}>
              Name
            </Table.SortableHeaderCell>
            <Table.HeaderCell>Aliases</Table.HeaderCell>
            <Table.HeaderCell>Categories</Table.HeaderCell>
            <Table.HeaderCell>Owner</Table.HeaderCell>
            <Table.HeaderCell>Lifecycle</Table.HeaderCell>
            <Table.SortableHeaderCell sortKey="usage" sort={sort} onSort={toggleSort} numeric>
              Usage
            </Table.SortableHeaderCell>
            <Table.SortableHeaderCell sortKey="status" sort={sort} onSort={toggleSort}>
              Status
            </Table.SortableHeaderCell>
            <Table.HeaderCell>Quality</Table.HeaderCell>
          </Table.Row>
        </Table.Head>
        <Table.Body>
          {sorted.length === 0 ? (
            <Table.EmptyRow colSpan={8}>
              {terms.isLoading ? 'Loading terms…' : 'No glossary terms match these filters.'}
            </Table.EmptyRow>
          ) : (
            sorted.map(term => (
              <Table.Row
                key={term.entity._uid}
                onClick={() =>
                  navigate({
                    to: '/$workspaceSlug/glossary/$termId',
                    params: { workspaceSlug, termId: term.entity._publicId }
                  })
                }
              >
                <Table.NameCell title={term.canonicalName} subtitle={term.entity._publicId} />
                <Table.Cell>
                  {term.aliases.length > 0 ? (
                    <div className={styles.tags}>
                      {term.aliases.map(alias => (
                        <Chip key={alias} tone="ghost">
                          {alias}
                        </Chip>
                      ))}
                    </div>
                  ) : (
                    <span className="dim">—</span>
                  )}
                </Table.Cell>
                <Table.Cell>
                  {term.categories.length > 0 ? (
                    <div className={styles.tags}>
                      {term.categories.map(category => {
                        const resolved = categoryById.get(category.id);
                        return (
                          <Chip key={category.id} tone="ghost" dot={resolved?.color}>
                            {resolved?.name ?? category.name}
                          </Chip>
                        );
                      })}
                    </div>
                  ) : (
                    <span className="dim">—</span>
                  )}
                </Table.Cell>
                <Table.Cell>{term.entity._owner?.name ?? <span className="dim">—</span>}</Table.Cell>
                <Table.Cell>
                  {term.entity._lifecycle ? (
                    <StatusChip value={term.entity._lifecycle.id} lifecycleStates={lifecycleStates} />
                  ) : (
                    <span className="dim">—</span>
                  )}
                </Table.Cell>
                <Table.Cell numeric>{term.usageCount}</Table.Cell>
                <Table.Cell className={styles.statusCell}>
                  {term.status ?? <span className="dim">—</span>}
                </Table.Cell>
                <Table.Cell>
                  <GlossaryQualityBadges quality={term.quality} />
                </Table.Cell>
              </Table.Row>
            ))
          )}
        </Table.Body>
      </Table.Root>
    </main>
  );
};
