import type { ReactElement } from 'react';
import {
  TbArrowsRightLeft,
  TbBinaryTree2,
  TbCalendarWeek,
  TbChartBubble,
  TbChartRadar,
  TbColumns3,
  TbGitCompare,
  TbGrid3X3,
  TbGridDots,
  TbLayoutGrid,
  TbList,
  TbMap,
  TbRoute,
  TbTable,
  TbVectorTriangle,
  TbShieldCheck
} from 'react-icons/tb';

/** Sidebar icon for a saved view, by its view mode. */
export const savedViewIcon = (mode: string, size = 12): ReactElement => {
  switch (mode) {
    case 'table':
      return <TbList size={size} />;
    case 'cards':
      return <TbLayoutGrid size={size} />;
    case 'tree':
      return <TbBinaryTree2 size={size} />;
    case 'radar':
      return <TbChartRadar size={size} />;
    case 'timeline':
      return <TbCalendarWeek size={size} />;
    case 'bubble-chart':
      return <TbChartBubble size={size} />;
    case 'heatmap':
      return <TbGridDots size={size} />;
    case 'relation-matrix':
      return <TbGrid3X3 size={size} />;
    case 'compare-dates':
      return <TbGitCompare size={size} />;
    case 'conformance':
      return <TbShieldCheck size={size} />;
    case 'trail':
      return <TbRoute size={size} />;
    case 'relation-columns':
      return <TbColumns3 size={size} />;
    case 'nested-map':
      return <TbMap size={size} />;
    case 'graph':
      return <TbVectorTriangle size={size} />;
    case 'traceability':
      return <TbArrowsRightLeft size={size} />;
    default:
      return <TbTable size={size} />;
  }
};
