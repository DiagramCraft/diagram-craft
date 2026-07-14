const STENCIL_ROOT_TOKEN = '$STENCIL_ROOT';

export const isStencilAssetUrl = (url: string, stencilRoot: string) =>
  url.includes(STENCIL_ROOT_TOKEN) || url.startsWith(`${stencilRoot}/stencils/`);

export const resolveStencilAssetUrl = (url: string, stencilRoot: string) =>
  url.replace(STENCIL_ROOT_TOKEN, stencilRoot);
