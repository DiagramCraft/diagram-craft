import { useState } from 'react';
import { Dialog } from '@diagram-craft/app-components/Dialog';
import { Tabs } from '@diagram-craft/app-components/Tabs';
import { useDocument } from '../../../application';
import { useRedraw } from '../../hooks/useRedraw';
import { TbTrash } from 'react-icons/tb';
import type { QueryEntry, QueryType } from '@diagram-craft/model/documentProps';
import { Button } from '@diagram-craft/app-components/Button';

type ManageSavedSearchesDialogProps = {
  open: boolean;
  onClose: () => void;
  initialSearchType?: QueryType;
};

const SavedSearchList = ({ type, title }: { type: QueryType; title: string }) => {
  const document = useDocument();
  const redraw = useRedraw();
  const saved = document.props.query.saved.filter(r => r.type === type);

  const handleRemove = (entry: QueryEntry) => {
    document.props.query.removeSaved(entry.type, entry.label, entry.scope, entry.value);
    redraw();
  };

  if (saved.length === 0) {
    return <div>No saved {title.toLowerCase()} searches</div>;
  }

  return (
    <div>
      <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
        {saved.map((entry, index) => (
          <div
            key={`${entry.label}-${index}`}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '8px 12px',
              marginBottom: '0.5rem',
              backgroundColor: 'var(--cmp-bg)'
            }}
          >
            <div style={{ flex: 1, minWidth: 0, fontSize: '11px', color: 'var(--cmp-fg)' }}>
              <div style={{ fontWeight: 'medium', marginBottom: '4px' }}>{entry.label}</div>
              <div>Scope: {entry.scope}</div>
              {entry.value !== entry.label && (
                <div
                  style={{
                    marginTop: '2px',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap'
                  }}
                >
                  Query: {entry.value}
                </div>
              )}
            </div>
            <Button
              onClick={() => handleRemove(entry)}
              type={'icon-only'}
              style={{ color: 'var(--error-fg)' }}
              title={`Remove "${entry.label}"`}
            >
              <TbTrash />
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
};

const getTabValueFromSearchType = (searchType?: QueryType): string => {
  switch (searchType) {
    case 'simple':
      return 'text';
    case 'advanced':
      return 'advanced';
    case 'djql':
      return 'djql';
    default:
      return 'text';
  }
};

export const ManageSavedSearchesDialog = (props: ManageSavedSearchesDialogProps) => {
  const [activeTab, setActiveTab] = useState(() =>
    getTabValueFromSearchType(props.initialSearchType)
  );

  return (
    <Dialog
      open={props.open}
      onClose={props.onClose}
      title="Manage Saved Searches"
      buttons={[
        {
          label: 'Close',
          type: 'cancel',
          onClick: props.onClose
        }
      ]}
    >
      <div style={{ minWidth: '500px', minHeight: '400px' }}>
        <Tabs.Root value={activeTab} onValueChange={setActiveTab}>
          <Tabs.List>
            <Tabs.Trigger value="text">By Text</Tabs.Trigger>
            <Tabs.Trigger value="advanced">Advanced</Tabs.Trigger>
            <Tabs.Trigger value="djql">DJQL</Tabs.Trigger>
          </Tabs.List>

          <Tabs.Content value="text">
            <SavedSearchList type="simple" title="Text" />
          </Tabs.Content>

          <Tabs.Content value="advanced">
            <SavedSearchList type="advanced" title="Advanced" />
          </Tabs.Content>

          <Tabs.Content value="djql">
            <SavedSearchList type="djql" title="DJQL" />
          </Tabs.Content>
        </Tabs.Root>
      </div>
    </Dialog>
  );
};
