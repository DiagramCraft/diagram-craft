import { createContext, useContext, useState, type ReactNode } from 'react';
import { TbChevronDown } from 'react-icons/tb';
import styles from './EntityDetailAccordion.module.css';

type AccordionContextValue = {
  isOpen: (value: string) => boolean;
  toggle: (value: string) => void;
};

const AccordionContext = createContext<AccordionContextValue | null>(null);

const useAccordionContext = (): AccordionContextValue => {
  const context = useContext(AccordionContext);
  if (!context)
    throw new Error('EntityDetailAccordion.Section must be used inside EntityDetailAccordion');
  return context;
};

const EntityDetailAccordionRoot = ({
  defaultOpen = [],
  children
}: {
  defaultOpen?: string[];
  children: ReactNode;
}) => {
  const [openSections, setOpenSections] = useState(() => new Set(defaultOpen));
  const isOpen = (value: string) => openSections.has(value);
  const toggle = (value: string) => {
    setOpenSections(previous => {
      const next = new Set(previous);
      if (next.has(value)) next.delete(value);
      else next.add(value);
      return next;
    });
  };

  return (
    <AccordionContext.Provider value={{ isOpen, toggle }}>
      <div className={styles.accordion}>{children}</div>
    </AccordionContext.Provider>
  );
};

const EntityDetailAccordionSection = ({
  value,
  title,
  count,
  children
}: {
  value: string;
  title: string;
  count?: number;
  children: ReactNode;
}) => {
  const { isOpen, toggle } = useAccordionContext();
  const open = isOpen(value);
  const panelId = `entity-detail-accordion-${value}`;

  return (
    <section className={`${styles.section} ${open ? styles.sectionOpen : ''}`}>
      <h3 className={styles.heading}>
        <button
          type="button"
          className={styles.trigger}
          aria-controls={panelId}
          aria-expanded={open}
          onClick={() => toggle(value)}
        >
          <span className={styles.title}>
            {title}
            {count !== undefined && <span className={styles.count}>({count})</span>}
          </span>
          <TbChevronDown className={styles.chevron} size={14} aria-hidden="true" />
        </button>
      </h3>
      <div id={panelId} className={styles.content} hidden={!open}>
        {children}
      </div>
    </section>
  );
};

export const EntityDetailAccordion = Object.assign(EntityDetailAccordionRoot, {
  Section: EntityDetailAccordionSection
});
