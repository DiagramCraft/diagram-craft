import { describe, expect, it } from 'vitest';
import { ImportArchiveValidationError, ZipBuilder, ZipExtractor } from './zipBuilder';

const toBuffer = async (stream: NodeJS.ReadableStream) => {
  const chunks: Buffer[] = [];
  for await (const chunk of stream as AsyncIterable<Buffer>) chunks.push(chunk);
  return Buffer.concat(chunks);
};

describe('ZipExtractor.parseImportZip', () => {
  it('rejects malformed JSON before returning import data', async () => {
    const archive = new ZipBuilder();
    archive.addText('manifest.json', '{"version":');
    const buffer = await toBuffer(await archive.finalize());

    await expect(ZipExtractor.parseImportZip(buffer)).rejects.toBeInstanceOf(
      ImportArchiveValidationError
    );
  });
});
