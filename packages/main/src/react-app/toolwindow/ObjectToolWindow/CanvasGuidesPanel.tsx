import { ToolWindowPanel } from '../ToolWindowPanel';

export const CanvasGuidesPanel = (props: Props) => {
  return (
    <ToolWindowPanel
      mode={props.mode ?? 'accordion'}
      title={'Guides'}
      id={'guides'}
    >
      <div className={'cmp-labeled-table'}>
        <div className={'cmp-labeled-table__label'}>Coming Soon</div>
        <div className={'cmp-labeled-table__value'}>
          <div>Guide configuration will be implemented here.</div>
        </div>
      </div>
    </ToolWindowPanel>
  );
};

type Props = {
  mode?: 'accordion' | 'panel';
};