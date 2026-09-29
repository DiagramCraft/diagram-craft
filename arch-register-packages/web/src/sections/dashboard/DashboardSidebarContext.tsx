import { createContext, useContext } from 'react';

/** Current selection values keyed by `dashboardSidebarConfigSchema.variableName`. */
export type DashboardSidebarVariables = Record<string, string>;

const DashboardSidebarContext = createContext<DashboardSidebarVariables>({});

export const DashboardSidebarProvider = DashboardSidebarContext.Provider;

/** The active dashboard sidebar's current selection, empty when the dashboard has no sidebar. */
export const useDashboardSidebarVariables = (): DashboardSidebarVariables =>
  useContext(DashboardSidebarContext);
