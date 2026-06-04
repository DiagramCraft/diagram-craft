import { Dialog } from '@diagram-craft/app-components/Dialog';
import { Scrollable } from '@diagram-craft/app-components/Scrollable';
import { useEffect, useRef, useState } from 'react';
import type { ComponentType } from 'react';
import {
  TbArrowRight,
  TbArrowsRandom,
  TbBinaryTree,
  TbBox,
  TbBrandChrome,
  TbCheck,
  TbCircuitResistor,
  TbCloud,
  TbDatabase,
  TbGitFork,
  TbGlobe,
  TbNetwork,
  TbPackage,
  TbRoute,
  TbSearch,
  TbShape,
  TbSquare,
  TbStack2,
  TbX
} from 'react-icons/tb';

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
  TbStack2,
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
  const searchRef = useRef<HTMLInputElement>(null);

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

  const q = query.trim().toLowerCase();
  const filtered = q
    ? packages.filter(
        p =>
          p.name.toLowerCase().includes(q) ||
          (p.description ?? '').toLowerCase().includes(q) ||
          (p.group ?? '').toLowerCase().includes(q)
      )
    : packages;

  const grouped = groupPackages(filtered);
  const enabledCount = draft.length;
  const totalCount = packages.length;

  const footerLeft = (
    <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--cmp-fg-dimmed)', fontSize: '11.5px' }}>
      <TbStack2 size={13} />
      <span>
        <strong style={{ color: 'var(--base-fg)', fontWeight: 600 }}>{enabledCount}</strong>
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
      sub={'Choose which shape libraries appear in the editor sidebar. Enabled packages load when you open a diagram.'}
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
      {/* Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '7px',
            flex: 1,
            minWidth: 0,
            height: '30px',
            padding: '0 9px',
            background: 'var(--cmp-bg)',
            border: '1px solid var(--cmp-border)',
            borderRadius: '5px',
            color: 'var(--cmp-fg-dimmed)'
          }}
        >
          <TbSearch size={14} style={{ flexShrink: 0 }} />
          <input
            ref={searchRef}
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search packages"
            style={{
              background: 'transparent',
              border: 0,
              outline: 0,
              flex: 1,
              minWidth: 0,
              color: 'var(--base-fg)',
              fontSize: '12px',
              fontFamily: 'inherit'
            }}
          />
          {query && (
            <button
              onClick={() => { setQuery(''); searchRef.current?.focus(); }}
              style={{
                background: 'none',
                border: 'none',
                padding: '2px',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--cmp-fg-dimmed)',
                borderRadius: '3px',
                flexShrink: 0
              }}
            >
              <TbX size={11} />
            </button>
          )}
        </div>
      </div>

      {/* Package list */}
      <Scrollable
        maxHeight={'calc(100vh - 34vh)'}
        style={{
          border: '1px solid var(--cmp-border)',
          borderRadius: '5px',
          background: 'var(--base-bg)'
        }}
      >
        {grouped.size === 0 ? (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              height: '120px',
              color: 'var(--cmp-fg-dimmed)',
              fontSize: '12px'
            }}
          >
            No packages match &ldquo;{query.trim()}&rdquo;
          </div>
        ) : (
          <div style={{ padding: '4px' }}>
            {Array.from(grouped.entries()).map(([groupName, pkgs]) => (
              <div key={groupName}>
                <div
                  style={{
                    padding: '8px 8px 4px',
                    fontSize: '10px',
                    letterSpacing: '0.7px',
                    textTransform: 'uppercase',
                    color: 'var(--cmp-fg-dimmed)'
                  }}
                >
                  {groupName}
                </div>
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
  const [hovered, setHovered] = useState(false);

  return (
    <button
      role="checkbox"
      aria-checked={isOn}
      onClick={onToggle}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        width: '100%',
        padding: '7px 8px',
        borderRadius: '4px',
        border: '1px solid transparent',
        textAlign: 'left',
        cursor: 'pointer',
        background: hovered
          ? isOn
            ? 'color-mix(in oklab, var(--accent-chroma) 12%, transparent)'
            : 'var(--cmp-bg)'
          : isOn
            ? 'color-mix(in oklab, var(--accent-chroma) 7%, transparent)'
            : 'transparent',
        fontFamily: 'inherit'
      }}
    >
      {/* Checkbox */}
      <span
        style={{
          width: '11px',
          height: '11px',
          flexShrink: 0,
          borderRadius: '3px',
          border: `1.5px solid ${isOn ? 'var(--accent-chroma)' : hovered ? 'var(--cmp-fg-dimmed)' : 'var(--cmp-border)'}`,
          background: isOn ? 'var(--accent-chroma)' : 'var(--cmp-bg)',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: isOn ? 'white' : 'transparent',
          transition: 'background 80ms, border-color 80ms, color 80ms'
        }}
      >
        <TbCheck size={8} />
      </span>

      {/* Icon */}
      <span
        style={{
          width: '30px',
          height: '30px',
          flexShrink: 0,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: '4px',
          border: `1px solid ${isOn ? 'color-mix(in oklch, var(--accent-chroma) 35%, var(--cmp-border))' : 'var(--cmp-border)'}`,
          background: 'var(--cmp-bg)',
          color: isOn ? 'var(--accent-chroma)' : 'var(--cmp-fg-dimmed)'
        }}
      >
        <IconComp size={16} />
      </span>

      {/* Text */}
      <span style={{ flex: 1, minWidth: 0 }}>
        <span
          style={{
            display: 'block',
            fontSize: '13px',
            color: isOn ? 'var(--base-fg)' : 'var(--cmp-fg)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap'
          }}
        >
          {pkg.name}
        </span>
        {pkg.description && (
          <span
            style={{
              display: 'block',
              fontSize: '11.5px',
              color: 'var(--cmp-fg-dimmed)',
              marginTop: '2px',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap'
            }}
          >
            {pkg.description}
          </span>
        )}
      </span>
    </button>
  );
};
