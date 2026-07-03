import React, {type ReactNode, useRef, useState} from 'react';
import ThemedImage from '@theme-original/ThemedImage';
import type ThemedImageType from '@theme/ThemedImage';
import type {WrapperProps} from '@docusaurus/types';
import useIsBrowser from '@docusaurus/useIsBrowser';
import ImageLightbox from '../../components/ImageLightbox/ImageLightbox';
import styles from './styles.module.css';

type Props = WrapperProps<typeof ThemedImageType>;

type LightboxState = {
  src: string;
  alt: string;
};

export default function ThemedImageWrapper(props: Props): ReactNode {
  const isBrowser = useIsBrowser();
  const containerRef = useRef<HTMLSpanElement>(null);
  const triggerRef = useRef<HTMLElement | null>(null);
  const [lightbox, setLightbox] = useState<LightboxState | null>(null);

  const openFromImg = (img: HTMLImageElement | null, trigger: HTMLElement) => {
    if (!img) return;
    triggerRef.current = trigger;
    setLightbox({ src: img.currentSrc || img.src, alt: img.alt });
  };

  const handleClick = (e: React.MouseEvent<HTMLSpanElement>) => {
    const img = (e.target as HTMLElement).closest('img');
    if (img) {
      openFromImg(img, e.currentTarget);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLSpanElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      openFromImg(containerRef.current?.querySelector('img') ?? null, e.currentTarget);
    }
  };

  const handleClose = () => {
    setLightbox(null);
    triggerRef.current?.focus();
  };

  return (
    <>
      <span
        ref={containerRef}
        role="button"
        tabIndex={0}
        className={styles.trigger}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
      >
        <ThemedImage {...props} />
      </span>
      {isBrowser && lightbox && (
        <ImageLightbox src={lightbox.src} alt={lightbox.alt} onClose={handleClose} />
      )}
    </>
  );
}
