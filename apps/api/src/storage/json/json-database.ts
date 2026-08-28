import { Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { copyFile, mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname } from 'node:path';
import { emptyDatabase, type DatabaseShape } from '../entities';
import type { DataStore } from '../repositories';

/**
 * Single-document JSON store: the whole dataset is held in memory and flushed
 * back to disk after every mutation.
 *
 * Writes are serialised through one promise chain and land via write-to-temp +
 * rename, so a crash mid-flush leaves the previous file intact rather than a
 * truncated one. This is deliberately a single-process store — it suits the
 * current no-scale target, and the repository interfaces exist so the swap to
 * PostgreSQL does not reach into the domain services.
 */
@Injectable()
export class JsonDatabase implements DataStore, OnModuleInit {
  readonly driver = 'json';

  private readonly logger = new Logger(JsonDatabase.name);
  private readonly path: string;
  private readonly seedPath: string;
  private data: DatabaseShape = emptyDatabase();
  private flushing: Promise<void> = Promise.resolve();
  private loaded = false;

  constructor(config: ConfigService) {
    const storage = config.getOrThrow<{ dataFile: string; seedFile: string }>('storage');
    this.path = storage.dataFile;
    this.seedPath = storage.seedFile;
  }

  async onModuleInit(): Promise<void> {
    await this.load();
  }

  async load(): Promise<void> {
    await mkdir(dirname(this.path), { recursive: true });

    if (!existsSync(this.path)) {
      if (existsSync(this.seedPath)) {
        await copyFile(this.seedPath, this.path);
        this.logger.log(`Initialised data file from seed at ${this.path}`);
      } else {
        await writeFile(this.path, JSON.stringify(emptyDatabase(), null, 2), 'utf8');
        this.logger.warn(`No seed found; started with an empty data file at ${this.path}`);
      }
    }

    const raw = await readFile(this.path, 'utf8');
    this.data = { ...emptyDatabase(), ...(JSON.parse(raw) as Partial<DatabaseShape>) };
    this.loaded = true;
    this.logger.log(`Loaded ${this.data.users.length} users from ${this.path}`);
  }

  /** Read-only view of the dataset. */
  read(): DatabaseShape {
    if (!this.loaded) throw new Error('JsonDatabase used before it finished loading');
    return this.data;
  }

  /** Applies a mutation and persists the result before resolving. */
  async mutate<T>(fn: (data: DatabaseShape) => T): Promise<T> {
    if (!this.loaded) throw new Error('JsonDatabase used before it finished loading');
    const result = fn(this.data);
    await this.flush();
    return result;
  }

  async isHealthy(): Promise<boolean> {
    if (!this.loaded) return false;
    try {
      await readFile(this.path, 'utf8');
      return true;
    } catch {
      return false;
    }
  }

  private flush(): Promise<void> {
    this.flushing = this.flushing.then(async () => {
      const snapshot = JSON.stringify(this.data, null, 2);
      const temp = `${this.path}.tmp`;
      await writeFile(temp, snapshot, 'utf8');
      await rename(temp, this.path);
    });
    return this.flushing;
  }
}
