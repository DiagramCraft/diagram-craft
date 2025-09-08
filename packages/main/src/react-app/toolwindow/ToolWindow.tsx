import React, {
  createContext,
  JSXElementConstructor,
  ReactElement,
  ReactNode,
  useContext,
  useEffect,
  useState
} from 'react';
import { assert, VERIFY_NOT_REACHED } from '@diagram-craft/utils/assert';
import styles from './ToolWindow.module.css';
import { ErrorBoundary } from '../ErrorBoundary';
import { Tabs } from '@diagram-craft/app-components/Tabs';
import { UserState } from '../../UserState';
import { useEventListener } from '../hooks/useEventListener';

type ToolWindowContextType = {
  activeTab: string;
  switchTab: (tabId: string) => void;
};

const ToolWindowContext = createContext<ToolWindowContextType | null>(null);

export const useToolWindowControls = (): ToolWindowContextType => {
  const context = useContext(ToolWindowContext);
  assert.present(context);
  return context;
};

type RootProps = {
  children: React.ReactNode | React.ReactNode[];
  defaultTab?: string;
  id: string;
};

const isReactElement = (
  element: ReactNode
): element is ReactElement<{ children?: ReactNode }, JSXElementConstructor<unknown>> =>
  element !== null && typeof element === 'object' && 'props' in element;

const Root = (props: RootProps) => {
  const userState = UserState.get();
  const savedTab = userState.getToolWindowTab(props.id);
  const [tab, setTab] = useState<string>(savedTab ?? props.defaultTab ?? '');

  const updateTab = (newTab: string) => {
    setTab(newTab);
    userState.setToolWindowTab(props.id, newTab);
  };

  useEventListener(userState, 'change', () => {
    const currentSavedTab = userState.getToolWindowTab(props.id);
    if (currentSavedTab && currentSavedTab !== tab) {
      setTab(currentSavedTab);
    }
  });

  useEffect(() => {
    const ids: string[] = [];
    React.Children.forEach(props.children, child => {
      if (!child) return;
      if (!isReactElement(child)) return;
      assert.true(child.type === Tab);

      ids.push((child.props as TabProps).id);
    });

    if (!ids.includes(tab)) {
      const fallbackTab = ids[0];
      setTab(fallbackTab);
      userState.setToolWindowTab(props.id, fallbackTab);
    }
  }, [props.children, tab, props.id, userState]);

  const contextValue: ToolWindowContextType = {
    activeTab: tab,
    switchTab: updateTab
  };

  return (
    <ToolWindowContext.Provider value={contextValue}>
      <Tabs.Root value={tab} onValueChange={updateTab}>
        <Tabs.List>
          {React.Children.map(props.children, child => {
            if (!child) return null;
            assert.present(child);
            if (!isReactElement(child)) throw VERIFY_NOT_REACHED('Invalid element');
            assert.true(child.type === Tab);

            return (
              <Tabs.Trigger value={(child.props as TabProps).id}>
                {(child.props as TabProps).title}
              </Tabs.Trigger>
            );
          })}
        </Tabs.List>

        {props.children}
      </Tabs.Root>
    </ToolWindowContext.Provider>
  );
};

type TabProps = {
  children: React.ReactNode | React.ReactNode[];
  title: string;
  id: string;
};

const Tab = (props: TabProps) => {
  return <Tabs.Content value={props.id}>{props.children}</Tabs.Content>;
};

type TabContentProps = { children: React.ReactNode };

const TabContent = (props: TabContentProps) => {
  return <ErrorBoundary>{props.children}</ErrorBoundary>;
};

type TabActions = {
  children: React.ReactNode | React.ReactNode[];
};

const TabActions = (props: TabActions) => {
  return <div className={styles.tabActions}>{props.children}</div>;
};

export const ToolWindow = {
  Root: Root,
  Tab: Tab,
  TabContent: TabContent,
  TabActions: TabActions
};
