import { Stream } from 'node:stream';
import { Page } from '@playwright/test';

export async function stream2buffer(stream: Stream): Promise<Buffer> {
  return new Promise<Buffer>((resolve, reject) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const _buf = Array<any>();

    stream.on('data', chunk => _buf.push(chunk));
    stream.on('end', () => resolve(Buffer.concat(_buf)));
    stream.on('error', err => reject(`error converting stream - ${err}`));
  });
}

export const waitForApplicationLoaded = async (page: Page) => {
  await page.getByRole('toolbar').first().waitFor();
};

export const downloadDiagram = async (page: Page) => {
  const downloadPromise = page.waitForEvent('download');
  await page.keyboard.press('Meta+e');
  const download = await downloadPromise;

  const readable = await download.createReadStream();

  return await stream2buffer(readable);
};

export const setTab = async (page: Page, n: number) => {
  const tablist = page.getByRole('tablist').first();
  await tablist.getByRole('tab').nth(n).click();
};
