import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActionName,
  formatKeyBinding,
  findKeyBindingsForAction
} from '@diagram-craft/canvas/keyMap';
import { useApplication } from '../../application';
import styles from './CommandPalette.module.css';

type CommandInfo = {
  id: ActionName;
  label: string;
  description?: string;
  keyBinding?: string;
  isEnabled: boolean;
};

type CommandPaletteProps = {
  open: boolean;
  onClose: () => void;
};

export const CommandPalette = ({ open, onClose }: CommandPaletteProps) => {
  const application = useApplication();
  const [searchText, setSearchText] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isKeyboardNavigation, setIsKeyboardNavigation] = useState(false);
  const commandListRef = useRef<HTMLDivElement>(null);
  const commandItemRefs = useRef<(HTMLDivElement | null)[]>([]);

  const commands = useMemo(() => {
    const actionMap = application.actions;
    const keyMap = application.keyMap;
    const result: CommandInfo[] = [];

    for (const [actionId, action] of Object.entries(actionMap)) {
      if (!action) continue;

      const keyBindings = findKeyBindingsForAction(actionId as ActionName, keyMap);
      const keyBinding = keyBindings.length > 0 ? formatKeyBinding(keyBindings[0]) : undefined;

      // Generate a human-readable label from the action ID
      const label = actionId
        .split('_')
        .map(part => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
        .join(' ');

      result.push({
        id: actionId as ActionName,
        label,
        keyBinding,
        isEnabled: action.isEnabled ? action.isEnabled({}) : true
      });
    }

    return result.sort((a, b) => a.label.localeCompare(b.label));
  }, [application.actions, application.keyMap]);

  const filteredCommands = useMemo(() => {
    if (!searchText.trim()) return [];

    const searchLower = searchText.toLowerCase();
    const filtered = commands.filter(
      cmd =>
        cmd.label.toLowerCase().includes(searchLower) ||
        cmd.id.toLowerCase().includes(searchLower) ||
        (cmd.keyBinding && cmd.keyBinding.toLowerCase().includes(searchLower))
    );

    // Sort so enabled actions come first, then disabled actions
    return filtered.sort((a, b) => {
      if (a.isEnabled && !b.isEnabled) return -1;
      if (!a.isEnabled && b.isEnabled) return 1;
      return a.label.localeCompare(b.label);
    });
  }, [commands, searchText]);

  const executeCommand = useCallback(
    (commandId: ActionName) => {
      const action = application.actions[commandId];
      if (action && (!action.isEnabled || action.isEnabled({}))) {
        action.execute({ source: 'ui-element' });
        onClose();
      }
    },
    [application.actions, onClose]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setIsKeyboardNavigation(true);
          setSelectedIndex(prev => Math.min(prev + 1, filteredCommands.length - 1));
          break;
        case 'ArrowUp':
          e.preventDefault();
          setIsKeyboardNavigation(true);
          setSelectedIndex(prev => Math.max(prev - 1, 0));
          break;
        case 'Enter':
          e.preventDefault();
          if (filteredCommands[selectedIndex]) {
            executeCommand(filteredCommands[selectedIndex].id);
          }
          break;
        case 'Escape':
          e.preventDefault();
          onClose();
          break;
      }
    },
    [filteredCommands, selectedIndex, executeCommand, onClose]
  );

  // Scroll selected item into view
  const scrollSelectedIntoView = useCallback(() => {
    const selectedElement = commandItemRefs.current[selectedIndex];
    if (selectedElement && commandListRef.current) {
      selectedElement.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
        inline: 'nearest'
      });
    }
  }, [selectedIndex]);

  // Reset selected index when search changes
  useEffect(() => {
    setSelectedIndex(0);
    setIsKeyboardNavigation(false);
    commandItemRefs.current = [];
  }, [searchText]);

  // Scroll selected item into view when selectedIndex changes
  useEffect(() => {
    scrollSelectedIntoView();
  }, [selectedIndex, scrollSelectedIntoView]);

  // Reset search when dialog opens
  useEffect(() => {
    if (open) {
      setSearchText('');
      setSelectedIndex(0);
    }
  }, [open]);

  if (!open) return null;

  return (
    <div className={styles.commandPalette} onClick={onClose}>
      <div className={styles.commandPalette__content} onClick={e => e.stopPropagation()}>
        <div className={styles.commandPalette__searchContainer}>
          <input
            className={styles.commandPalette__searchInput}
            type="text"
            placeholder="Type a command..."
            value={searchText}
            onChange={e => setSearchText(e.target.value)}
            onKeyDown={handleKeyDown}
            autoFocus
          />
        </div>

        <div ref={commandListRef} className={styles.commandPalette__commandList}>
          {filteredCommands.length === 0 ? (
            <div className={styles.commandPalette__noResults}>
              {searchText.trim() ? 'No commands found' : 'Start typing to search for commands...'}
            </div>
          ) : (
            filteredCommands.map((command, index) => (
              <div
                key={command.id}
                ref={el => commandItemRefs.current[index] = el}
                className={`${styles.commandPalette__commandItem} ${
                  index === selectedIndex ? styles['commandPalette__commandItem--selected'] : ''
                } ${!command.isEnabled ? styles['commandPalette__commandItem--disabled'] : ''}`}
                onClick={() => command.isEnabled && executeCommand(command.id)}
                onMouseEnter={() => {
                  if (!isKeyboardNavigation) {
                    setSelectedIndex(index);
                  }
                }}
                onMouseMove={() => {
                  if (isKeyboardNavigation) {
                    setIsKeyboardNavigation(false);
                  }
                }}
              >
                <div className={styles.commandPalette__commandInfo}>
                  <div className={styles.commandPalette__commandLabel}>{command.label}</div>
                  {command.description && (
                    <div className={styles.commandPalette__commandDescription}>
                      {command.description}
                    </div>
                  )}
                </div>
                {command.keyBinding && (
                  <div className={styles.commandPalette__keyBinding}>{command.keyBinding}</div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
