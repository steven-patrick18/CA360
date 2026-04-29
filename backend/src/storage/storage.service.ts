import { Injectable, OnModuleInit, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join, normalize, resolve } from 'node:path';

/**
 * StorageService — opaque key/value blob store.
 *
 * Phase 1 implementation writes to the local filesystem under
 * STORAGE_LOCAL_PATH. The interface is small on purpose so a future
 * S3 / MinIO implementation can be slotted in without touching the
 * services that consume it (DocumentsService etc.).
 *
 * Keys are firm-scoped (`firm/<firmId>/...`) so an admin browsing the
 * folder can immediately tell which firm a file belongs to. RLS at the
 * DB level is the actual security boundary; the path layout is just
 * organizational.
 */
@Injectable()
export class StorageService implements OnModuleInit {
  private rootDir!: string;

  constructor(private readonly config: ConfigService) {}

  async onModuleInit() {
    const driver = this.config.get<string>('STORAGE_DRIVER') ?? 'local';
    if (driver !== 'local') {
      throw new InternalServerErrorException(
        `Unsupported STORAGE_DRIVER "${driver}". Only "local" is implemented in Phase 1.`,
      );
    }
    const localPath = this.config.get<string>('STORAGE_LOCAL_PATH') ?? './storage';
    this.rootDir = resolve(localPath);
    if (!existsSync(this.rootDir)) {
      await mkdir(this.rootDir, { recursive: true });
    }
  }

  private resolvePath(key: string): string {
    // Reject path traversal attempts. Keys must be plain relative paths.
    const normalized = normalize(key).replace(/^[\\/]+/, '');
    if (normalized.startsWith('..') || normalized.includes('..\\') || normalized.includes('../')) {
      throw new InternalServerErrorException('Invalid storage key');
    }
    return join(this.rootDir, normalized);
  }

  async put(key: string, buffer: Buffer): Promise<void> {
    const fullPath = this.resolvePath(key);
    await mkdir(dirname(fullPath), { recursive: true });
    await writeFile(fullPath, buffer);
  }

  async get(key: string): Promise<Buffer> {
    return readFile(this.resolvePath(key));
  }

  async delete(key: string): Promise<void> {
    try {
      await unlink(this.resolvePath(key));
    } catch (e) {
      // If the file is already gone we don't care — the DB row is the source of truth.
      const err = e as NodeJS.ErrnoException;
      if (err.code !== 'ENOENT') throw e;
    }
  }
}
