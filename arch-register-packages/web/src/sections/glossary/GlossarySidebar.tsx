import { useMemo, type ReactNode } from 'react';
import { useNavigate, useSearch } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { TbTag, TbEyeOff, TbAlertTriangle, TbHistory, TbUserOff } from 'react-icons/tb';
import { TreeRow } from '../../components/TreeRow';
import { SidebarGroupLabel, SidebarTitleHeader } from '../../components/sidebar/SidebarPrimitives';
import { schemaColor } from '../../lib/schemaPresentation';
import { glossaryConfigQuery, glossaryTermsQuery } from '../../queries/glossary';
import { entitiesQuery } from '../../queries/entities';
import type { GlossarySearchParams } from '../../routes/searchParams';
import styles from '../../shell/SidePanel.module.css';

type GlossaryQualityKind = 'unused' | 'conflicting' | 'deprecated' | 'ownerless';

const QUALITY_FACETS: { value: GlossaryQualityKind; label: string; icon: typeof TbEyeOff }[] = [
  { value: 'unused', label: 'Unused', icon: TbEyeOff },
  { value: 'conflicting', label: 'Conflicting', icon: TbAlertTriangle },
  { value: 'deprecated', label: 'Deprecated', icon: TbHistory },
  { value: 'ownerless', label: 'Missing owner', icon: TbUserOff }
];

const FacetRow = ({
  icon,
  label,
  testId,
  checked,
  onToggle,
  trailing,
  tagColor
}: {
  icon: ReactNode;
  label: string;
  testId: string;
  checked: boolean;
  onToggle: () => void;
  trailing?: ReactNode;
  tagColor?: string;
}) => (
  <TreeRow
    icon={icon}
    testId={testId}
    label={
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
        <input
          type="checkbox"
          checked={checked}
          aria-label={`Filter by ${label}`}
          onChange={onToggle}
          onClick={event => event.stopPropagation()}
          style={{ margin: 0 }}
        />
        <span>{label}</span>
      </span>
    }
    active={checked}
    onClick={onToggle}
    trailing={trailing}
    tagColor={tagColor}
  />
);

export const GlossarySidebar = ({ workspaceSlug }: { workspaceSlug: string }) => {
  const navigate = useNavigate();
  const search = useSearch({ strict: false }) as GlossarySearchParams;
  const { data: config } = useQuery(glossaryConfigQuery(workspaceSlug));
  const enabled = !!config;

  const { data: categoriesData } = useQuery(
    entitiesQuery(
      workspaceSlug,
      { schemaId: config?.categorySchemaId, view: 'summary', limit: 100 },
      enabled
    )
  );
  const { data: termsData } = useQuery(glossaryTermsQuery(workspaceSlug, { limit: 200 }, enabled));

  const categories = categoriesData?.items ?? [];
  // Facet counts and this pill's total are derived from the first 200 terms (the max page size);
  // workspaces with more than 200 glossary terms will show undercounted category/quality facets
  // here until a dedicated facet-count endpoint exists.
  const terms = termsData?.items ?? [];
  const totalTerms = termsData?.total ?? 0;

  const categoryCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const term of terms) {
      for (const category of term.categories) {
        counts.set(category.id, (counts.get(category.id) ?? 0) + 1);
      }
    }
    return counts;
  }, [terms]);

  const qualityCounts = useMemo(() => {
    const counts: Record<GlossaryQualityKind, number> = {
      unused: 0,
      conflicting: 0,
      deprecated: 0,
      ownerless: 0
    };
    for (const term of terms) {
      if (term.quality.unused) counts.unused++;
      if (term.quality.conflicting) counts.conflicting++;
      if (term.quality.deprecated) counts.deprecated++;
      if (term.quality.ownerless) counts.ownerless++;
    }
    return counts;
  }, [terms]);

  const selectedCategoryIds = useMemo(
    () => (search.categoryIds ?? '').split(',').filter(Boolean),
    [search.categoryIds]
  );
  const selectedQuality = search.quality;
  const hasAnySelection = selectedCategoryIds.length > 0 || !!selectedQuality;

  const patchSearch = (patch: Partial<GlossarySearchParams>) =>
    navigate({
      to: '/$workspaceSlug/glossary',
      params: { workspaceSlug },
      search: (previous: Record<string, unknown>) => ({ ...previous, ...patch })
    });

  const toggleCategory = (id: string) => {
    const next = selectedCategoryIds.includes(id)
      ? selectedCategoryIds.filter(current => current !== id)
      : [...selectedCategoryIds, id];
    patchSearch({ categoryIds: next.length > 0 ? next.join(',') : undefined });
  };

  const toggleQuality = (value: GlossaryQualityKind) =>
    patchSearch({ quality: selectedQuality === value ? undefined : value });

  const clearAll = () => patchSearch({ categoryIds: undefined, quality: undefined });

  return (
    <>
      <SidebarTitleHeader title="Glossary" />
      <div className={styles.scroll}>
        {!enabled ? (
          <div className={`${styles.emptyState} dim`}>Business glossary is not enabled.</div>
        ) : (
          <>
            <TreeRow
              icon={<TbTag size={12} />}
              label="All terms"
              testId="glossary-filter-all"
              active={!hasAnySelection}
              onClick={clearAll}
              trailing={<span className="dim mono">{totalTerms}</span>}
            />
            <SidebarGroupLabel>Category</SidebarGroupLabel>
            {categories.map((category, index) => (
              <FacetRow
                key={category._uid}
                testId={`glossary-filter-category-${category._uid}`}
                icon={
                  <span
                    style={{
                      display: 'inline-block',
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      background: schemaColor(index)
                    }}
                  />
                }
                label={category._name}
                checked={selectedCategoryIds.includes(category._uid)}
                onToggle={() => toggleCategory(category._uid)}
                trailing={<span className="dim mono">{categoryCounts.get(category._uid) ?? 0}</span>}
                tagColor={schemaColor(index)}
              />
            ))}
            <SidebarGroupLabel>Quality</SidebarGroupLabel>
            {QUALITY_FACETS.map(({ value, label, icon: FacetIcon }) => (
              <FacetRow
                key={value}
                testId={`glossary-filter-quality-${value}`}
                icon={<FacetIcon size={12} />}
                label={label}
                checked={selectedQuality === value}
                onToggle={() => toggleQuality(value)}
                trailing={<span className="dim mono">{qualityCounts[value]}</span>}
              />
            ))}
          </>
        )}
      </div>
    </>
  );
};
