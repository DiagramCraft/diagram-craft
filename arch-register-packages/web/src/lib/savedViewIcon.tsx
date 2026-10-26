import type { ReactElement } from 'react';
import {
  TbArrowsRightLeft,
  TbBinaryTree2,
  TbCalendarWeek,
  TbChartRadar,
  TbColumns3,
  TbLayoutGrid,
  TbList,
  TbMap,
  TbTable,
  TbVectorTriangle
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
    case 'explore':
      return <TbColumns3 size={size} />;
    case 'map':
      return <TbMap size={size} />;
    case 'graph':
      return <TbVectorTriangle size={size} />;
    case 'traceability':
      return <TbArrowsRightLeft size={size} />;
    default:
      return <TbTable size={size} />;
  }
};
