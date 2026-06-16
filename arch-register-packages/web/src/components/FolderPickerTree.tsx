import { useState } from 'react';
import { TbFolder, TbFolderOpen, TbHome } from 'react-icons/tb';
import { TreeRow } from './TreeRow';
import type { ProjectFile } from '@arch-register/api-types/projectContract';

type FolderNode = {
  path: string;
  name: string;
  children: FolderNode[];
};

const buildFolderTree = (
  folders: Array<{ path: string; name: string; files: ProjectFile[] }>
): FolderNode[] => {
  const root: FolderNode[] = [];
  const map = new Map<string, FolderNode>();

  for (const folder of [...folders].sort((a, b) => a.path.localeCompare(b.path))) {
    const parts = folder.path.split('/');
    const node: FolderNode = { path: folder.path, name: folder.name, children: [] };
    map.set(folder.path, node);

    if (parts.length === 1) {
      root.push(node);
    } else {
      const parentPath = parts.slice(0, -1).join('/');
      const parent = map.get(parentPath);
      if (parent) {
        parent.children.push(node);
      } else {
        root.push(node);
      }
    }
  }

  return root;
};

type FolderPickerTreeProps = {
  folders: Array<{ path: string; name: string; files: ProjectFile[] }>;
  selected: string | null;
  onSelect: (folder: string | null) => void;
};

const FolderRow = ({
  node,
  depth,
  selected,
  expanded,
  onToggle,
  onSelect
}: {
  node: FolderNode;
  depth: number;
  selected: string | null;
  expanded: Set<string>;
  onToggle: (path: string) => void;
  onSelect: (folder: string | null) => void;
}) => {
  const isExpanded = expanded.has(node.path);
  const isSelected = selected === node.path;

  return (
    <>
      <TreeRow
        depth={depth}
        icon={isExpanded ? <TbFolderOpen size={14} /> : <TbFolder size={14} />}
        label={node.name}
        active={isSelected}
        expandable={node.children.length > 0}
        expanded={isExpanded}
        onExpand={() => onToggle(node.path)}
        onClick={() => onSelect(node.path)}
      />
      {isExpanded &&
        node.children.map(child => (
          <FolderRow
            key={child.path}
            node={child}
            depth={depth + 1}
            selected={selected}
            expanded={expanded}
            onToggle={onToggle}
            onSelect={onSelect}
          />
        ))}
    </>
  );
};

export const FolderPickerTree = ({ folders, selected, onSelect }: FolderPickerTreeProps) => {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const tree = buildFolderTree(folders);

  const toggle = (path: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  };

  return (
    <div style={{ border: '1px solid var(--cmp-border)', borderRadius: 4, height: 196, overflowY: 'auto', background: 'var(--cmp-bg)' }}>
      <TreeRow
        depth={0}
        icon={<TbHome size={14} />}
        label="/ (root)"
        active={selected === null}
        onClick={() => onSelect(null)}
      />
      {tree.map(node => (
        <FolderRow
          key={node.path}
          node={node}
          depth={1}
          selected={selected}
          expanded={expanded}
          onToggle={toggle}
          onSelect={onSelect}
        />
      ))}
    </div>
  );
};
