import React, { type ReactNode } from 'react';
import Link from '@docusaurus/Link';
import { useDoc } from '@docusaurus/plugin-content-docs/client';
import styles from './styles.module.css';

type RelatedReadingItem = {
  label: string;
  to: string;
};

type RelatedReadingFrontMatter = {
  related_reading?: RelatedReadingItem[];
};

export default function RelatedReading(): ReactNode {
  const { frontMatter } = useDoc();
  const items = (frontMatter as RelatedReadingFrontMatter).related_reading;

  if (!items || items.length === 0) {
    return null;
  }

  return (
    <div className={styles.relatedReading}>
      <div className={styles.relatedReadingTitle}>Related Topics</div>
      <ul className={styles.relatedReadingList}>
        {items.map(item => (
          <li key={item.to}>
            <Link to={item.to}>{item.label}</Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
