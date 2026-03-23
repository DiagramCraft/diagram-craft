const EDGE_LIMIT = 8;
const NODE_LIMIT = 16;
const REQUIRED_NODE_STENCIL_IDS = ['default@@text', 'default@@rect'];

export const NO_SHAPE_ID = '__no_shape__';

export const getRecentEdgeStylesheetIds = (
  recentIds: readonly string[],
  allIds: readonly string[],
  activeId?: string
) => {
  const availableIds = Array.from(new Set(allIds.filter(Boolean)));
  if (availableIds.length <= EDGE_LIMIT) {
    return availableIds;
  }

  const lruIds = Array.from(new Set([...recentIds.filter(Boolean), activeId].filter(Boolean)));
  return Array.from(new Set([...lruIds, ...availableIds])).slice(0, EDGE_LIMIT);
};

export const getRecentNodeStencilIds = (recentIds: readonly string[]) => {
  const ids = [NO_SHAPE_ID, ...REQUIRED_NODE_STENCIL_IDS, ...recentIds];
  return Array.from(new Set(ids)).slice(0, NODE_LIMIT + 1);
};

export const getNodeStencilIds = (
  recentIds: readonly string[],
  allIds: readonly string[],
  basicShapeIds: readonly string[]
) => {
  const pinnedIds = [NO_SHAPE_ID, ...REQUIRED_NODE_STENCIL_IDS];
  const availableIds = Array.from(
    new Set(allIds.filter(Boolean).filter(id => !REQUIRED_NODE_STENCIL_IDS.includes(id)))
  );
  const recentAvailableIds = recentIds.filter(id => availableIds.includes(id));
  const basicAvailableIds = basicShapeIds.filter(id => availableIds.includes(id));

  return Array.from(new Set([...pinnedIds, ...recentAvailableIds, ...basicAvailableIds, ...availableIds])).slice(
    0,
    NODE_LIMIT
  );
};
