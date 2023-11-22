export const ToolWindowAccordion = (props: Props) => {
  return (
    <div className={'cmp-tool-window-accordion'}>
      <div className={'cmp-tool-window-accordion__header'}>{props.title}</div>
      <div className={'cmp-tool-window-accordion__content'}>{props.children}</div>
    </div>
  );
};

type Props = {
  title: string;
  children: React.ReactNode;
};
