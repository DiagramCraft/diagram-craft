export const ToolBarGroup = (props: Props) => {
  return (
    <div className={'cmp-toolbar-group'}>
      <div className={'cmp-toolbar-group__label'}>{props.label}</div>
      <div className={'cmp-toolbar-group__content'}>{props.children}</div>
    </div>
  );
};

type Props = {
  label: string;
  children: React.ReactNode;
};
