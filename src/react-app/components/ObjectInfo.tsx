export const ObjectInfo = (props: { state: State }) => (
  <div className={'cmp-object-info'}>
    <dl>
      <dt>Id:</dt>
      <dd>{props.state.id ?? '-'}</dd>

      <dt>X:</dt>
      <dd>{props.state.x ?? '-'}</dd>

      <dt>Y:</dt>
      <dd>{props.state.y ?? '-'}</dd>

      <dt>W:</dt>
      <dd>{props.state.w ?? '-'}</dd>

      <dt>H:</dt>
      <dd>{props.state.h ?? '-'}</dd>

      <dt>Rotation:</dt>
      <dd>{props.state.rotation ?? '-'}</dd>

      <dt>Props:</dt>
      <dd>
        <pre>{props.state.props ?? '-'}</pre>
      </dd>
    </dl>
  </div>
);

export type State = {
  id?: string;
  x?: number;
  y?: number;
  w?: number;
  h?: number;
  rotation?: number;
  props?: string;
};
