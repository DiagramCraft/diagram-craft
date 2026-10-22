import { createContext, useContext, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

/** DOM node inside the section header where a sub-section's actions are rendered. */
export const SectionActionsSlotContext = createContext<HTMLElement | null>(null);

/** Renders its children (typically buttons) into the workspace settings section header. */
export const SectionActions = ({ children }: { children: ReactNode }) => {
  const slot = useContext(SectionActionsSlotContext);
  return slot ? createPortal(children, slot) : null;
};
