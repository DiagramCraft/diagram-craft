export type GuideType = 'horizontal' | 'vertical';

export interface Guide {
  id: string;
  type: GuideType;
  position: number;
  color?: string;
}

export const DEFAULT_GUIDE_COLOR = 'var(--accent-9)';
