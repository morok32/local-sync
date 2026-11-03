import { Plugin, TFile, Notice } from "obsidian";

const SUPPRESS_TIMEOUT_MS = 5000;
const MODIFY_DEBOUNCE_MS = 700;

export default class LocalSyncPlugin extends Plugin {
  // Временный список файлов, которые меняет сам плагин.
  private suppress: Set<string> = new Set();

  // Таймеры debounce.
  private timers: Record<string, number> = {};

  async onload(): Promise<void> {
    console.log("Local Sync plugin loaded");

    this.addCommand({
      id: "local-sync-test",
      name: "Show Local Sync test message",
      callback: () => {
        new Notice("Local Sync: plugin works");
      },
    });

    this.registerEvent(
      this.app.vault.on("modify", (file) => {
        if (!(file instanceof TFile)) {
          return;
        }

        if (file.extension.toLowerCase() !== "md") {
          return;
        }

        const path = file.path;

        if (this.suppress.has(path)) {
          return;
        }

        const existingTimer = this.timers[path];
        if (existingTimer) {
          window.clearTimeout(existingTimer);
        }

        this.timers[path] = window.setTimeout(() => {
          delete this.timers[path];
          this.handleFileModified(file).catch((err) => {
            console.error("Local Sync: modify handler error", err);
          });
        }, MODIFY_DEBOUNCE_MS);
      })
    );
  }

  onunload(): void {
    console.log("Local Sync plugin unloaded");
  }

  private async handleFileModified(file: TFile): Promise<void> {
    if (this.suppress.has(file.path)) {
      return;
    }

    const cache = this.app.metadataCache.getFileCache(file);
    const frontmatter = cache?.frontmatter;

    if (!frontmatter || typeof frontmatter !== "object") {
      return;
    }

    if (!("sync" in frontmatter)) {
      return;
    }

    if (frontmatter.sync !== true) {
      return;
    }

    await this.setSync(file, false);
  }

  private async setSync(file: TFile, value: boolean): Promise<void> {
    const path = file.path;

    this.suppress.add(path);

    try {
      // ИСПРАВЛЕНО: processFrontMatter (с большой M) и (fm: any)
      await this.app.fileManager.processFrontMatter(file, (fm: any) => {
        if ("sync" in fm) {
          fm.sync = value;
        }
      });

      new Notice(`Local Sync: sync set to ${value} for ${file.basename}`);
    } finally {
      window.setTimeout(() => {
        this.suppress.delete(path);
      }, SUPPRESS_TIMEOUT_MS);
    }
  }
}