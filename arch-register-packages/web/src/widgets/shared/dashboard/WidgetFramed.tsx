import { createContext, useContext } from 'react';

/**
 * Whether the widget is currently rendered inside a visible dashboard widget frame (border and
 * header). False when the frame is hidden and outside the dashboard (e.g. wiki embeds), so
 * widgets that draw their own surface can avoid doubling up on the frame's border.
 */
const WidgetFramedContext = createContext(false);

export const WidgetFramedProvider = WidgetFramedContext.Provider;

export const useWidgetFramed = (): boolean => useContext(WidgetFramedContext);
