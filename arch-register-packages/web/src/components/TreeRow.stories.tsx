import type { Meta, StoryObj } from '@storybook/react-vite';
import { TreeRow } from './TreeRow';
import { TbFolder, TbFile, TbDatabase, TbServer, TbCloud } from 'react-icons/tb';
import { useState } from 'react';

const meta = {
  title: 'Components/TreeRow',
  component: TreeRow,
  parameters: {
    layout: 'padded'
  },
  tags: ['autodocs'],
  argTypes: {
    depth: {
      control: { type: 'range', min: 0, max: 5, step: 1 }
    },
    active: {
      control: 'boolean'
    },
    expandable: {
      control: 'boolean'
    },
    expanded: {
      control: 'boolean'
    },
    tagColor: {
      control: 'color'
    }
  }
} satisfies Meta<typeof TreeRow>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    label: 'Default Row',
    icon: <TbFolder size={16} />
  }
};

export const Active: Story = {
  args: {
    label: 'Active Row',
    icon: <TbFolder size={16} />,
    active: true
  }
};

export const WithTrailing: Story = {
  args: {
    label: 'Row with trailing content',
    icon: <TbFile size={16} />,
    trailing: <span style={{ fontSize: '11px', color: '#666' }}>Modified 2h ago</span>
  }
};

export const WithTagColor: Story = {
  args: {
    label: 'Row with tag',
    icon: <TbDatabase size={16} />,
    tagColor: '#3b82f6'
  }
};

export const Expandable: Story = {
  args: {
    label: 'Expandable Row',
    icon: <TbFolder size={16} />,
    expandable: true,
    expanded: false
  }
};

export const Expanded: Story = {
  args: {
    label: 'Expanded Row',
    icon: <TbFolder size={16} />,
    expandable: true,
    expanded: true
  }
};

export const NestedDepth = {
  render: () => (
    <div style={{ width: '300px', border: '1px solid #e5e7eb', borderRadius: '4px' }}>
      <TreeRow label="Root" icon={<TbFolder size={16} />} depth={0} expandable expanded />
      <TreeRow label="Level 1" icon={<TbFolder size={16} />} depth={1} expandable expanded />
      <TreeRow label="Level 2" icon={<TbFolder size={16} />} depth={2} expandable expanded />
      <TreeRow label="Level 3" icon={<TbFile size={16} />} depth={3} />
      <TreeRow label="Level 3" icon={<TbFile size={16} />} depth={3} />
      <TreeRow label="Level 2" icon={<TbFile size={16} />} depth={2} />
      <TreeRow label="Level 1" icon={<TbFile size={16} />} depth={1} />
    </div>
  )
};

export const InteractiveTree = {
  render: () => {
    const [expanded, setExpanded] = useState<Record<string, boolean>>({
      root: true,
      folder1: false,
      folder2: true
    });
    const [active, setActive] = useState<string | null>('file1');

    return (
      <div style={{ width: '300px', border: '1px solid #e5e7eb', borderRadius: '4px' }}>
        <TreeRow
          label="Root Folder"
          icon={<TbFolder size={16} />}
          depth={0}
          expandable
          expanded={expanded.root}
          onExpand={() => setExpanded(prev => ({ ...prev, root: !prev.root }))}
          active={active === 'root'}
          onClick={() => setActive('root')}
        />
        {expanded.root && (
          <>
            <TreeRow
              label="Folder 1"
              icon={<TbFolder size={16} />}
              depth={1}
              expandable
              expanded={expanded.folder1}
              onExpand={() => setExpanded(prev => ({ ...prev, folder1: !prev.folder1 }))}
              active={active === 'folder1'}
              onClick={() => setActive('folder1')}
            />
            {expanded.folder1 && (
              <>
                <TreeRow
                  label="File 1.1"
                  icon={<TbFile size={16} />}
                  depth={2}
                  active={active === 'file1.1'}
                  onClick={() => setActive('file1.1')}
                />
                <TreeRow
                  label="File 1.2"
                  icon={<TbFile size={16} />}
                  depth={2}
                  active={active === 'file1.2'}
                  onClick={() => setActive('file1.2')}
                />
              </>
            )}
            <TreeRow
              label="Folder 2"
              icon={<TbFolder size={16} />}
              depth={1}
              expandable
              expanded={expanded.folder2}
              onExpand={() => setExpanded(prev => ({ ...prev, folder2: !prev.folder2 }))}
              active={active === 'folder2'}
              onClick={() => setActive('folder2')}
              tagColor="#22c55e"
            />
            {expanded.folder2 && (
              <>
                <TreeRow
                  label="File 2.1"
                  icon={<TbFile size={16} />}
                  depth={2}
                  active={active === 'file2.1'}
                  onClick={() => setActive('file2.1')}
                  trailing={<span style={{ fontSize: '11px', color: '#666' }}>2.3 KB</span>}
                />
              </>
            )}
            <TreeRow
              label="File 1"
              icon={<TbFile size={16} />}
              depth={1}
              active={active === 'file1'}
              onClick={() => setActive('file1')}
            />
          </>
        )}
      </div>
    );
  }
};

export const DifferentIcons = {
  render: () => (
    <div style={{ width: '300px', border: '1px solid #e5e7eb', borderRadius: '4px' }}>
      <TreeRow label="Folder" icon={<TbFolder size={16} />} />
      <TreeRow label="File" icon={<TbFile size={16} />} />
      <TreeRow label="Database" icon={<TbDatabase size={16} />} tagColor="#8b5cf6" />
      <TreeRow label="Server" icon={<TbServer size={16} />} tagColor="#3b82f6" />
      <TreeRow label="Cloud" icon={<TbCloud size={16} />} tagColor="#06b6d4" />
    </div>
  )
};

export const WithContextMenu: Story = {
  args: {
    label: 'Right-click me',
    icon: <TbFile size={16} />,
    onContextMenu: (e: React.MouseEvent) => {
      e.preventDefault();
      alert('Context menu clicked!');
    }
  }
};

export const ComplexExample = {
  render: () => (
    <div style={{ width: '400px', border: '1px solid #e5e7eb', borderRadius: '4px' }}>
      <TreeRow
        label="Services"
        icon={<TbFolder size={16} />}
        depth={0}
        expandable
        expanded
        trailing={<span style={{ fontSize: '11px', color: '#666' }}>12 items</span>}
      />
      <TreeRow
        label="API Gateway"
        icon={<TbServer size={16} />}
        depth={1}
        active
        tagColor="#3b82f6"
        trailing={<span style={{ fontSize: '11px', color: '#22c55e' }}>●</span>}
      />
      <TreeRow
        label="Auth Service"
        icon={<TbServer size={16} />}
        depth={1}
        tagColor="#8b5cf6"
        trailing={<span style={{ fontSize: '11px', color: '#22c55e' }}>●</span>}
      />
      <TreeRow
        label="Database"
        icon={<TbDatabase size={16} />}
        depth={1}
        tagColor="#ef4444"
        trailing={<span style={{ fontSize: '11px', color: '#ef4444' }}>●</span>}
      />
      <TreeRow
        label="Infrastructure"
        icon={<TbFolder size={16} />}
        depth={0}
        expandable
        expanded={false}
        trailing={<span style={{ fontSize: '11px', color: '#666' }}>5 items</span>}
      />
    </div>
  )
};
