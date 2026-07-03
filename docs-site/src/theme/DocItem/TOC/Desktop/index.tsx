import React, {type ReactNode} from 'react';
import Translate from '@docusaurus/Translate';
import Desktop from '@theme-original/DocItem/TOC/Desktop';
import type DesktopType from '@theme/DocItem/TOC/Desktop';
import type {WrapperProps} from '@docusaurus/types';
import RelatedReading from '@site/src/components/RelatedReading';
import styles from './styles.module.css';

type Props = WrapperProps<typeof DesktopType>;

export default function DesktopWrapper(props: Props): ReactNode {
  return (
    <>
      <div className={styles.tocTitle}>
        <Translate
          id="theme.TOC.title"
          description="The title shown above the desktop table of contents">
          On this page
        </Translate>
      </div>
      <Desktop {...props} />
      <RelatedReading />
    </>
  );
}
