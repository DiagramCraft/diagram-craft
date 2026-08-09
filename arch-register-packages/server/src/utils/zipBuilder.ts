import { createWriteStream } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { ZipArchive, type Archiver } from 'archiver';
import unzipper from 'unzipper';
import type { Readable } from 'node:stream';
import type { ExportManifest } from '../domain/workspace/exportTypes';
import {
  parseExportManifest,
  parseExportPackage,
  type ParsedExportPackage
} from '../domain/workspace/exportSchemas';

export class ImportArchiveValidationError extends Error {
  constructor(
    readonly filename: string,
    cause: unknown
  ) {
    const detail = cause instanceof Error ? cause.message : 'invalid JSON structure';
    super(`Invalid import archive file "${filename}": ${detail}`, { cause });
    this.name = 'ImportArchiveValidationError';
  }
}

export class ZipBuilder {
  private archive: Archiver;
  private finalized = false;

  constructor() {
    this.archive = new ZipArchive({
      zlib: { level: 9 } // Maximum compression
    });
  }

  /**
   * Add a JSON file to the archive
   */
  addJson(filename: string, data: unknown): void {
    if (this.finalized) {
      throw new Error('Cannot add files to finalized archive');
    }
    const content = JSON.stringify(data, null, 2);
    this.archive.append(content, { name: filename });
  }

  /**
   * Add a text file to the archive
   */
  addText(filename: string, content: string): void {
    if (this.finalized) {
      throw new Error('Cannot add files to finalized archive');
    }
    this.archive.append(content, { name: filename });
  }

  /**
   * Add a file from a buffer
   */
  addBuffer(filename: string, buffer: Buffer): void {
    if (this.finalized) {
      throw new Error('Cannot add files to finalized archive');
    }
    this.archive.append(buffer, { name: filename });
  }

  /**
   * Add a file from a stream
   */
  addStream(filename: string, stream: Readable): void {
    if (this.finalized) {
      throw new Error('Cannot add files to finalized archive');
    }
    this.archive.append(stream, { name: filename });
  }

  /**
   * Add a file from the filesystem
   */
  addFile(filename: string, filepath: string): void {
    if (this.finalized) {
      throw new Error('Cannot add files to finalized archive');
    }
    this.archive.file(filepath, { name: filename });
  }

  /**
   * Create a directory in the archive
   */
  addDirectory(dirname: string): void {
    if (this.finalized) {
      throw new Error('Cannot add directories to finalized archive');
    }
    this.archive.append('', { name: `${dirname}/` });
  }

  /**
   * Finalize the archive and return the stream
   */
  async finalize(): Promise<Readable> {
    if (this.finalized) {
      throw new Error('Archive already finalized');
    }
    this.finalized = true;
    await this.archive.finalize();
    return this.archive;
  }

  /**
   * Get the archive stream (for piping to response)
   */
  getStream(): Readable {
    return this.archive;
  }

  /**
   * Write the archive to a file
   */
  async writeToFile(filepath: string): Promise<void> {
    const output = createWriteStream(filepath);
    this.archive.pipe(output);
    await this.archive.finalize();

    return new Promise((resolve, reject) => {
      output.on('close', resolve);
      output.on('error', reject);
      this.archive.on('error', reject);
    });
  }
}

export class ZipExtractor {
  /**
   * Extract a specific file from a ZIP buffer and return its content as a string
   */
  static async extractFileAsString(zipBuffer: Buffer, filename: string): Promise<string | null> {
    const directory = await unzipper.Open.buffer(zipBuffer);
    const file = directory.files.find(f => f.path === filename);

    if (!file) {
      return null;
    }

    const buffer = await file.buffer();
    return buffer.toString('utf-8');
  }

  /**
   * Extract a specific file from a ZIP buffer and return its content as a Buffer
   */
  static async extractFileAsBuffer(zipBuffer: Buffer, filename: string): Promise<Buffer | null> {
    const directory = await unzipper.Open.buffer(zipBuffer);
    const file = directory.files.find(f => f.path === filename);

    if (!file) {
      return null;
    }

    return await file.buffer();
  }

  /**
   * Extract multiple files from a ZIP buffer
   */
  static async extractFiles(zipBuffer: Buffer, filenames: string[]): Promise<Map<string, string>> {
    const directory = await unzipper.Open.buffer(zipBuffer);
    const results = new Map<string, string>();

    for (const filename of filenames) {
      const file = directory.files.find(f => f.path === filename);
      if (file) {
        const buffer = await file.buffer();
        results.set(filename, buffer.toString('utf-8'));
      }
    }

    return results;
  }

  /**
   * List all files in a ZIP buffer
   */
  static async listFiles(zipBuffer: Buffer): Promise<string[]> {
    const directory = await unzipper.Open.buffer(zipBuffer);
    return directory.files.map(f => f.path);
  }

  /**
   * Extract all files from a ZIP buffer to a directory
   */
  static async extractAll(zipBuffer: Buffer, targetDir: string): Promise<void> {
    const directory = await unzipper.Open.buffer(zipBuffer);

    for (const file of directory.files) {
      if (file.type === 'Directory') {
        await mkdir(join(targetDir, file.path), { recursive: true });
      } else {
        const targetPath = join(targetDir, file.path);
        await mkdir(dirname(targetPath), { recursive: true });
        const buffer = await file.buffer();
        const fs = await import('node:fs/promises');
        await fs.writeFile(targetPath, buffer);
      }
    }
  }

  /**
   * Parse a ZIP buffer and extract JSON files and content files
   */
  static async parseImportZip(zipBuffer: Buffer): Promise<{
    manifest: ExportManifest;
    config?: ParsedExportPackage['config'];
    schemas?: ParsedExportPackage['schemas'];
    relation_schemas?: ParsedExportPackage['relation_schemas'];
    entities?: ParsedExportPackage['entities'];
    relations?: ParsedExportPackage['relations'];
    projects?: ParsedExportPackage['projects'];
    content_nodes?: ParsedExportPackage['content_nodes'];
    documents?: ParsedExportPackage['documents'];
    contentFiles?: Map<string, Buffer>;
    jsonFiles: Map<string, string>;
  }> {
    const directory = await unzipper.Open.buffer(zipBuffer);

    // Extract JSON metadata files
    const files = await ZipExtractor.extractFiles(zipBuffer, [
      'manifest.json',
      'config.json',
      'schemas.json',
      'relation-schemas.json',
      'entities.json',
      'relations.json',
      'projects.json',
      'content-nodes.json',
      'documents.json'
    ]);

    const manifestStr = files.get('manifest.json');
    if (!manifestStr) {
      throw new ImportArchiveValidationError('manifest.json', new Error('manifest.json not found'));
    }

    const parseJson = <T>(filename: string, parser: (value: unknown) => T): T => {
      const content = files.get(filename);
      if (content === undefined) {
        throw new ImportArchiveValidationError(filename, new Error('file not found'));
      }
      try {
        return parser(JSON.parse(content));
      } catch (error) {
        if (error instanceof ImportArchiveValidationError) throw error;
        throw new ImportArchiveValidationError(filename, error);
      }
    };

    const manifest = parseJson('manifest.json', parseExportManifest);
    for (const [key, filename] of Object.entries(manifest.files)) {
      if (key === 'content_directory') continue;
      if (!files.has(filename)) {
        throw new ImportArchiveValidationError(filename, new Error('declared file not found'));
      }
    }

    let packageData: ParsedExportPackage;
    try {
      packageData = parseExportPackage({
        ...(files.has('config.json') && { config: parseJson('config.json', value => value) }),
        ...(files.has('schemas.json') && { schemas: parseJson('schemas.json', value => value) }),
        ...(files.has('relation-schemas.json') && {
          relation_schemas: parseJson('relation-schemas.json', value => value)
        }),
        ...(files.has('entities.json') && { entities: parseJson('entities.json', value => value) }),
        ...(files.has('relations.json') && {
          relations: parseJson('relations.json', value => value)
        }),
        ...(files.has('projects.json') && { projects: parseJson('projects.json', value => value) }),
        ...(files.has('content-nodes.json') && {
          content_nodes: parseJson('content-nodes.json', value => value)
        }),
        ...(files.has('documents.json') && {
          documents: parseJson('documents.json', value => value)
        })
      });
    } catch (error) {
      if (error instanceof ImportArchiveValidationError) throw error;
      throw new ImportArchiveValidationError('archive data', error);
    }

    const result = {
      manifest,
      ...packageData,
      contentFiles: new Map<string, Buffer>(),
      jsonFiles: files
    };

    // Extract content files from content/ directory
    const contentFiles = new Map<string, Buffer>();
    for (const file of directory.files) {
      if (file.path.startsWith('content/') && file.type !== 'Directory') {
        const buffer = await file.buffer();
        contentFiles.set(file.path, buffer);
      }
    }

    if (contentFiles.size > 0) {
      result.contentFiles = contentFiles;
    }

    return result;
  }
}
