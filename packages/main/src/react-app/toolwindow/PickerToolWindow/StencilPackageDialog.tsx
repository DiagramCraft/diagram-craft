import { Dialog } from '@diagram-craft/app-components/Dialog';
import { Scrollable } from '@diagram-craft/app-components/Scrollable';
import { TextInput } from '@diagram-craft/app-components/TextInput';
import { useEffect, useMemo, useState } from 'react';
import type { ComponentType } from 'react';
import {
  TbArrowRight,
  TbArrowsRandom,
  TbBinaryTree,
  TbBox,
  TbBrandChrome,
  TbCircuitResistor,
  TbCloud,
  TbDatabase,
  TbGitFork,
  TbGlobe,
  TbNetwork,
  TbPackage,
  TbRoute,
  TbShape,
  TbSquare,
  TbStack2
} from 'react-icons/tb';
import styles from './StencilPackageDialog.module.css';

type IconComponent = ComponentType<{ size?: number; style?: React.CSSProperties }>;

const ICON_MAP: Record<string, IconComponent> = {
  TbArrowRight,
  TbArrowsRandom,
  TbBinaryTree,
  TbBox,
  TbBrandChrome,
  TbCircuitResistor,
  TbCloud,
  TbDatabase,
  TbGitFork,
  TbGlobe,
  TbNetwork,
  TbPackage,
  TbRoute,
  TbShape,
  TbSquare,
  TbStack2
};

export type StencilPackageOption = {
  id: string;
  name: string;
  description?: string;
  icon?: string;
  group?: string;
};

type Props = {
  open: boolean;
  onClose: () => void;
  packages: ReadonlyArray<StencilPackageOption>;
  activePackageIds: ReadonlyArray<string>;
  onSave: (ids: string[]) => void;
};

const groupPackages = (
  packages: ReadonlyArray<StencilPackageOption>
): Map<string, StencilPackageOption[]> => {
  const groups = new Map<string, StencilPackageOption[]>();
  for (const pkg of packages) {
    const key = pkg.group ?? 'Other';
    const existing = groups.get(key);
    if (existing) {
      existing.push(pkg);
    } else {
      groups.set(key, [pkg]);
    }
  }
  return groups;
};

export const StencilPackageDialog = ({
  open,
  onClose,
  packages,
  activePackageIds,
  onSave
}: Props) => {
  const [draft, setDraft] = useState<string[]>(activePackageIds as string[]);
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (!open) return;
    setDraft([...activePackageIds]);
    setQuery('');
  }, [activePackageIds, open]);

  const toggle = (id: string) => {
    setDraft(current => {
      if (current.includes(id)) {
        if (current.length === 1) return current;
        return current.filter(x => x !== id);
      }
      return [...current, id];
    });
  };

  const grouped = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = q
      ? packages.filter(
          p =>
            p.name.toLowerCase().includes(q) ||
            (p.description ?? '').toLowerCase().includes(q) ||
            (p.group ?? '').toLowerCase().includes(q)
        )
      : packages;
    return groupPackages(filtered);
  }, [packages, query]);
  const enabledCount = draft.length;
  const totalCount = packages.length;

  const footerLeft = (
    <span className={styles.eFooterLeft}>
      <TbStack2 size={13} />
      <span>
        <strong>{enabledCount}</strong>
        {' of '}
        {totalCount}
        {' packages enabled'}
      </span>
    </span>
  );

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={'Stencil packages'}
      sub={
        'Choose which shape libraries appear in the editor sidebar. Enabled packages load when you open a diagram.'
      }
      width={620}
      footerLeft={footerLeft}
      buttons={[
        {
          label: 'Cancel',
          type: 'cancel',
          onClick: () => onClose()
        },
        {
          label: 'Save',
          type: 'default',
          onClick: () => {
            onSave(draft);
            onClose();
          }
        }
      ]}
    >
      <div className={styles.icStencilPackageDialog}>
        <div className={styles.eToolbar}>
          <TextInput
            variant="search"
            value={query}
            onChange={v => setQuery(v ?? '')}
            onClear={() => setQuery('')}
            placeholder="Search packages"
            style={{ flex: 1 }}
          />
        </div>

        <Scrollable
          maxHeight={'calc(100vh - 54vh)'}
          style={{
            border: '1px solid var(--cmp-border)',
            borderRadius: '5px',
            background: 'var(--base-bg)'
          }}
        >
          {grouped.size === 0 ? (
            <div className={styles.eEmpty}>
              No packages match &ldquo;{query.trim()}&rdquo;
            </div>
          ) : (
            <div className={styles.ePackageList}>
              {Array.from(grouped.entries()).map(([groupName, pkgs]) => (
                <div key={groupName}>
                  <div className={styles.eGroupLabel}>{groupName}</div>
                  {pkgs.map(pkg => {
                    const isOn = draft.includes(pkg.id);
                    const IconComp = ICON_MAP[pkg.icon ?? ''] ?? TbPackage;
                    return (
                      <PackageRow
                        key={pkg.id}
                        pkg={pkg}
                        isOn={isOn}
                        IconComp={IconComp}
                        onToggle={() => toggle(pkg.id)}
                      />
                    );
                  })}
                </div>
              ))}
            </div>
          )}
        </Scrollable>
      </div>
    </Dialog>
  );
};

type PackageRowProps = {
  pkg: StencilPackageOption;
  isOn: boolean;
  IconComp: IconComponent;
  onToggle: () => void;
};

const PackageRow = ({ pkg, isOn, IconComp, onToggle }: PackageRowProps) => {
  return (
    <label className={styles.eRow}>
      <input type="checkbox" checked={isOn} onChange={onToggle} />
      <span className={styles.eIcon}>
        <IconComp size={16} />
      </span>
      <span className={styles.eText}>
        <span className={styles.eName}>{pkg.name}</span>
        {pkg.description && (
          <span className={styles.eDesc}>{pkg.description}</span>
        )}
      </span>
    </label>
  );
};
