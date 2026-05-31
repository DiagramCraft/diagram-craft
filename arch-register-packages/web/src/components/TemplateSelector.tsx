import { useState } from 'react';
import type { ProjectFile } from '../api';
import styles from './TemplateSelector.module.css';

type TemplateSelectorProps = {
  workspaceTemplates: ProjectFile[];
  projectTemplates: ProjectFile[];
  onSelect: (template: ProjectFile | null) => void;
  onCancel: () => void;
};

export const TemplateSelector = ({ 
  workspaceTemplates, 
  projectTemplates, 
  onSelect, 
  onCancel 
}: TemplateSelectorProps) => {
  const [selectedTemplate, setSelectedTemplate] = useState<ProjectFile | null>(null);

  const handleSelect = (template: ProjectFile | null) => {
    setSelectedTemplate(template);
  };

  const handleConfirm = () => {
    onSelect(selectedTemplate);
  };

  const hasWorkspaceTemplates = workspaceTemplates.length > 0;
  const hasProjectTemplates = projectTemplates.length > 0;

  return (
    <div className={styles.templateSelector}>
      <div className={styles.templateSections}>
        {hasProjectTemplates && (
          <div className={styles.templateSection}>
            <h3 className={styles.sectionTitle}>Project Templates</h3>
            <div className={styles.templateList}>
              {projectTemplates.map(template => (
                <button
                  key={template.id}
                  type="button"
                  onClick={() => handleSelect(template)}
                  className={`${styles.templateOption} ${selectedTemplate?.id === template.id ? styles.templateOptionSelected : ''}`}
                >
                  <span className={styles.templateIcon}>📋</span>
                  <span className={styles.templateName}>{template.name}</span>
                </button>
              ))}
            </div>
          </div>
        )}
        
        {hasWorkspaceTemplates && (
          <div className={styles.templateSection}>
            <h3 className={styles.sectionTitle}>Workspace Templates</h3>
            <div className={styles.templateList}>
              {workspaceTemplates.map(template => (
                <button
                  key={template.id}
                  type="button"
                  onClick={() => handleSelect(template)}
                  className={`${styles.templateOption} ${selectedTemplate?.id === template.id ? styles.templateOptionSelected : ''}`}
                >
                  <span className={styles.templateIcon}>🌐</span>
                  <span className={styles.templateName}>{template.name}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        <div className={styles.templateSection}>
          <h3 className={styles.sectionTitle}>Blank Diagram</h3>
          <div className={styles.templateList}>
            <button
              type="button"
              onClick={() => handleSelect(null)}
              className={`${styles.templateOption} ${styles.blankOption} ${selectedTemplate === null ? styles.templateOptionSelected : ''}`}
            >
              <span className={styles.templateIcon}>📄</span>
              <span className={styles.templateName}>Create blank diagram</span>
            </button>
          </div>
        </div>
      </div>

      <div className={styles.actions}>
        <button type="button" className={styles.btnCancel} onClick={onCancel}>
          Cancel
        </button>
        <button 
          type="button" 
          className={styles.btnConfirm} 
          onClick={handleConfirm}
          disabled={selectedTemplate === undefined}
        >
          Continue
        </button>
      </div>
    </div>
  );
};
