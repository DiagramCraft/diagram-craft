import {
  EventEmitter,
  EventKey,
  EventMap,
  EventReceiver,
  WithWildcardEvent
} from '../../utils/event.ts';
import { RefObject, useEffect } from 'react';

export const useEventListener = <
  T extends EventMap,
  K extends EventKey<WithWildcardEvent<T>> = EventKey<T>
>(
  target: EventEmitter<T>,
  eventName: K,
  handler: EventReceiver<WithWildcardEvent<T[K]>>
) => {
  useEffect(() => {
    target.on(eventName, handler);
    return () => {
      target.off(eventName, handler);
    };
  }, [target, eventName, handler]);
};

export function useDomEventListener<K extends keyof WindowEventMap>(
  eventName: K,
  handler: (event: WindowEventMap[K]) => void,
  element: typeof window
): void;

export function useDomEventListener<K extends keyof HTMLElementEventMap, T extends HTMLElement>(
  eventName: K,
  handler: (event: HTMLElementEventMap[K]) => void,
  element: RefObject<T>
): void;

export function useDomEventListener<K extends keyof SVGElementEventMap, T extends SVGElement>(
  eventName: K,
  handler: (event: SVGElementEventMap[K]) => void,
  element: RefObject<T>
): void;

export function useDomEventListener<K extends keyof DocumentEventMap>(
  eventName: K,
  handler: (event: DocumentEventMap[K]) => void,
  element: typeof document
): void;

export function useDomEventListener<
  KeyW extends keyof WindowEventMap,
  KeyHTML extends keyof HTMLElementEventMap,
  KeySVG extends keyof SVGElementEventMap,
  KeyDoc extends keyof DocumentEventMap,
  T extends HTMLElement
>(
  eventName: KeyW | KeyHTML,
  handler: (
    event:
      | WindowEventMap[KeyW]
      | HTMLElementEventMap[KeyHTML]
      | DocumentEventMap[KeyDoc]
      | SVGElementEventMap[KeySVG]
      | Event
  ) => void,
  element: RefObject<T> | typeof window | typeof document
) {
  useEffect(() => {
    const $target =
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      element === window || element === document ? element : (element as RefObject<any>)?.current;
    if (!$target || !$target.addEventListener) return;

    $target.addEventListener(eventName, handler);
    return () => {
      $target.removeEventListener(eventName, handler);
    };
  }, [eventName, element, handler]);
}
