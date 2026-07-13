import { useCallback, useEffect, useRef, useState } from 'react';

export const useDelayedDisclosure = (openDelay = 250, closeDelay = 120) => {
  const [open, setOpen] = useState(false);
  const timerRef = useRef<number | null>(null);

  const cancel = useCallback(() => {
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    timerRef.current = null;
  }, []);

  useEffect(() => cancel, [cancel]);

  const scheduleOpen = useCallback(() => {
    cancel();
    timerRef.current = window.setTimeout(() => setOpen(true), openDelay);
  }, [cancel, openDelay]);

  const scheduleClose = useCallback(() => {
    cancel();
    timerRef.current = window.setTimeout(() => setOpen(false), closeDelay);
  }, [cancel, closeDelay]);

  const setOpenImmediately = useCallback(
    (value: boolean) => {
      cancel();
      setOpen(value);
    },
    [cancel]
  );

  return { open, setOpen: setOpenImmediately, scheduleOpen, scheduleClose, cancel };
};
