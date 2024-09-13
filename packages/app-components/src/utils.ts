export const extractDataAttributes = (
  props: Record<string, unknown>,
  include?: string[] | undefined
) =>
  Object.keys(props).reduce(
    (acc, key) => {
      if (
        key.startsWith('data-') &&
        (include === undefined || include.includes(key.substring(5)))
      ) {
        acc[key] = props[key];
      }

      return acc;
    },
    {} as Record<string, unknown>
  );

export type DataAttributes = { [dataAttibute: `data-${string}`]: string };

const MOUSE_EVENTS = [
  'onContextMenu',
  'onPointerCancel',
  'onPointerDown',
  'onPointerEnter',
  'onPointerLeave',
  'onPointerMove',
  'onPointerOut',
  'onPointerOver',
  'onPointerUp',
  'onTouchCancel',
  'onTouchEnd',
  'onTouchMove',
  'onTouchStart'
];

export const extractMouseEvents = (props: Record<string, unknown>) =>
  Object.keys(props).reduce(
    (acc, key) => {
      if (MOUSE_EVENTS.includes(key)) {
        acc[key] = props[key];
      }

      return acc;
    },
    {} as Record<string, unknown>
  );

export const asValueArray = (d: Record<string, boolean>) => {
  return Object.entries(d)
    .filter(([_, v]) => v)
    .map(([k, _]) => k);
};
