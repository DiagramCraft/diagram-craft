declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Extensions {
    interface Tools {}
  }
}

export interface Tools extends Extensions.Tools {}

export type ToolType = keyof Tools;
