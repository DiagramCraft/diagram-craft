import { Button } from '@diagram-craft/app-components/Button';
import { Menu } from '@diagram-craft/app-components/Menu';
import { MenuButton } from '@diagram-craft/app-components/MenuButton';
import { useApplication } from '../../../application';
import { TbAdjustments, TbLayersSelectedBottom, TbLink, TbPlus, TbRectangle } from 'react-icons/tb';

const CREATE_LAYER_ACTIONS = [
  { action: 'LAYER_ADD', label: 'Layer', icon: TbRectangle },
  { action: 'LAYER_ADD_REFERENCE', label: 'Reference layer', icon: TbLink },
  { action: 'LAYER_ADD_RULE', label: 'Rule layer', icon: TbAdjustments },
  {
    action: 'LAYER_ADD_MODIFICATION',
    label: 'Modification layer',
    icon: TbLayersSelectedBottom
  }
] as const;

export const LayerListTabActions = () => {
  const application = useApplication();

  return (
    <MenuButton.Root>
      <MenuButton.Trigger
        element={
          <Button variant={'icon-only'} aria-label={'Add layer'} title={'Add layer'}>
            <TbPlus />
          </Button>
        }
      />
      <MenuButton.Menu align={'end'}>
        {CREATE_LAYER_ACTIONS.map(item => {
          const Icon = item.icon;
          return (
            <Menu.Item
              key={item.action}
              leftSlot={<Icon />}
              onClick={() => application.actions[item.action]?.execute()}
            >
              {item.label}
            </Menu.Item>
          );
        })}
      </MenuButton.Menu>
    </MenuButton.Root>
  );
};
