/**
 * Config Hot-Reload (S2.6)
 * Watches config YAML files and emits change events without process restart.
 */

import { watch, readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { EventEmitter } from 'node:events';

export interface ConfigFile {
  path: string;
  content?: unknown;
  lastModified: Date;
}

export class ConfigWatcher extends EventEmitter {
  private files: Map<string, ConfigFile> = new Map();
  private watchers: Map<string, ReturnType<typeof watch>> = new Map();

  constructor(private configDir: string) {
    super();
  }

  addFile(name: string): void {
    const filePath = resolve(this.configDir, name);
    if (!existsSync(filePath)) {
      console.warn(`[Config] File not found (watching for creation): ${filePath}`);
    }

    const watcher = watch(filePath, { recursive: false }, (eventType: string) => {
      if (eventType === 'change') {
        try {
          const content = readFileSync(filePath, 'utf-8');
          const lastModified = new Date();
          const fileInfo: ConfigFile = { path: filePath, content, lastModified };
          this.files.set(name, fileInfo);
          console.log(`[Config] Hot-reload: ${name} updated at ${lastModified.toISOString()}`);
          this.emit('change', { name, filePath, content, lastModified });
        } catch (err) {
          console.error(`[Config] Hot-reload error for ${name}:`, err);
        }
      }
    });

    this.watchers.set(name, watcher);
    console.log(`[Config] Watching: ${filePath}`);
  }

  getConfig(name: string): ConfigFile | undefined {
    return this.files.get(name);
  }

  stop(): void {
    for (const [name, watcher] of this.watchers.entries()) {
      watcher.close();
      console.log(`[Config] Stopped watching: ${name}`);
    }
    this.files.clear();
    this.watchers.clear();
  }
}
