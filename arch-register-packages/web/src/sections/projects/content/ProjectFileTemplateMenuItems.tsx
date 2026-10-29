import { Menu } from '@diagram-craft/app-components/src/Menu';
import { TbStar } from 'react-icons/tb';
import type { ProjectFile } from '@arch-register/api-types/projectContentContract';
import { useToggleTemplateStatus } from '../../../hooks/useTemplates';

/** "Template…" submenu for a diagram in the project content context menu. */
export const ProjectFileTemplateMenuItems = ({
  workspaceId,
  projectId,
  file,
  onDone
}: {
  workspaceId: string;
  projectId: string;
  file: ProjectFile;
  onDone: () => void;
}) => {
  const toggleTemplateStatus = useToggleTemplateStatus(workspaceId, projectId);

  const setTemplateStatus = (isTemplate: boolean, isWorkspaceTemplate: boolean) =>
    toggleTemplateStatus.mutate(
      { filePath: file.path, isTemplate, isWorkspaceTemplate },
      // Close the menu so it re-renders with fresh data
      { onSuccess: onDone }
    );

  const isWorkspaceTemplate = file.is_workspace_template === true;
  const isProjectTemplate = file.is_template === true && !isWorkspaceTemplate;

  return (
    <Menu.SubMenu label="Template…" leftSlot={<TbStar size={13} />}>
      <Menu.CheckboxItem
        checked={isWorkspaceTemplate}
        onCheckedChange={() => setTemplateStatus(!isWorkspaceTemplate, !isWorkspaceTemplate)}
      >
        Workspace Template
      </Menu.CheckboxItem>
      <Menu.CheckboxItem
        checked={isProjectTemplate}
        // A workspace template switches to a project template rather than toggling off
        onCheckedChange={() => setTemplateStatus(!isProjectTemplate, false)}
      >
        Project Template
      </Menu.CheckboxItem>
      <Menu.CheckboxItem
        checked={file.is_template !== true && !isWorkspaceTemplate}
        onCheckedChange={() => {
          onDone();
          toggleTemplateStatus.mutate({
            filePath: file.path,
            isTemplate: false,
            isWorkspaceTemplate: false
          });
        }}
      >
        None
      </Menu.CheckboxItem>
    </Menu.SubMenu>
  );
};
