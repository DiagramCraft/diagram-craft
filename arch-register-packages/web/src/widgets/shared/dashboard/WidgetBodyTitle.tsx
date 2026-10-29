import { createContext, useContext } from 'react';

/**
 * The widget title set by the user, provided only when the frame (and so its header) is hidden.
 * Frameless widgets such as stat tiles render it themselves, in place of the header title.
 */
const WidgetBodyTitleContext = createContext<string | undefined>(undefined);

export const WidgetBodyTitleProvider = WidgetBodyTitleContext.Provider;

export const useWidgetBodyTitle = (): string | undefined => useContext(WidgetBodyTitleContext);
