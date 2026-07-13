import { createWriteStream } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import archiver from 'archiver';
import unzipper from 'unzipper';
import type { Readable } from 'node:stream';

export class ZipBuilder {
  private archive: archiver.Archiver;
  private finalized = false;

  constructor() {
    this.archive = archiver('zip', {
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
  static async extractFiles(
    zipBuffer: Buffer,
    filenames: string[]
  ): Promise<Map<string, string>> {
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
    manifest: unknown;
    config?: unknown;
    schemas?: unknown;
    entities?: unknown;
    projects?: unknown;
    content_nodes?: unknown;
    contentFiles?: Map<string, Buffer>;
    jsonFiles: Map<string, string>;
  }> {
    const directory = await unzipper.Open.buffer(zipBuffer);
    
    // Extract JSON metadata files
    const files = await ZipExtractor.extractFiles(zipBuffer, [
      'manifest.json',
      'config.json',
      'schemas.json',
      'entities.json',
      'projects.json',
      'content-nodes.json'
    ]);

    const manifestStr = files.get('manifest.json');
    if (!manifestStr) {
      throw new Error('Invalid import file: manifest.json not found');
    }

    const result: {
      manifest: unknown;
      config?: unknown;
      schemas?: unknown;
      entities?: unknown;
      projects?: unknown;
      content_nodes?: unknown;
      contentFiles?: Map<string, Buffer>;
      jsonFiles: Map<string, string>;
    } = {
      manifest: JSON.parse(manifestStr),
      jsonFiles: files
    };

    const configStr = files.get('config.json');
    if (configStr) result.config = JSON.parse(configStr);

    const schemasStr = files.get('schemas.json');
    if (schemasStr) result.schemas = JSON.parse(schemasStr);

    const entitiesStr = files.get('entities.json');
    if (entitiesStr) result.entities = JSON.parse(entitiesStr);

    const projectsStr = files.get('projects.json');
    if (projectsStr) result.projects = JSON.parse(projectsStr);

    const contentNodesStr = files.get('content-nodes.json');
    if (contentNodesStr) result.content_nodes = JSON.parse(contentNodesStr);

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
