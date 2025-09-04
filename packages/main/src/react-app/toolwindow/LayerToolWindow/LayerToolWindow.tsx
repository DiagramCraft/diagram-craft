import { useState } from 'react';
import { LayerList } from './LayerList';
import { $c } from '@diagram-craft/utils/classname';
import * as Tabs from '@radix-ui/react-tabs';
import { TagsPanel } from './TagsPanel';
import { DocumentPanel } from './DocumentPanel';

export const LayerToolWindow = () => {
  const [tab, setTab] = useState<string>('layer');

  return (
    <Tabs.Root className={'cmp-tool-tabs'} value={tab} onValueChange={e => setTab(e)}>
      <Tabs.List className={$c('cmp-tool-tabs__tabs', { hidden: false })}>
        <Tabs.Trigger className="cmp-tool-tabs__tab-trigger util-vcenter" value={'layer'}>
          Layer
        </Tabs.Trigger>
        <Tabs.Trigger className="cmp-tool-tabs__tab-trigger util-vcenter" value={'document'}>
          Document
        </Tabs.Trigger>
        <Tabs.Trigger className="cmp-tool-tabs__tab-trigger util-vcenter" value={'tags'}>
          Tags
        </Tabs.Trigger>
      </Tabs.List>

      <Tabs.Content value={'layer'}>
        <div className={'cmp-panel__headless cmp-panel__headless--no-padding'}>
          <LayerList />
        </div>
      </Tabs.Content>
      <Tabs.Content value={'document'}>
        <div className={'cmp-panel__headless cmp-panel__headless--no-padding'}>
          <DocumentPanel />
        </div>
      </Tabs.Content>
      <Tabs.Content value={'tags'}>
        <div className={'cmp-panel__headless cmp-panel__headless--no-padding'}>
          <TagsPanel />
        </div>
      </Tabs.Content>
    </Tabs.Root>
  );
};
