export interface WritableFs {
  writeFile(path: string, data: Uint8Array): void;
  unlink(path: string): void;
}

// Large files (videos) stay in IndexedDB until the engine opens them, keeping memory low on tablets.
export class OnDemandFiles {
  private readonly users = new Map<string, number>();

  constructor(
    private readonly fs: WritableFs,
    private readonly dataDir: string,
    private readonly readGameFile: (gamePath: string) => Promise<Uint8Array>,
  ) {}

  private gamePath(path: string) {
    const prefix = `${this.dataDir}/`;
    return path.startsWith(prefix) ? path.slice(prefix.length) : path.replace(/^\.\//, '');
  }

  async acquire(path: string): Promise<void> {
    const gamePath = this.gamePath(path);
    const count = this.users.get(gamePath) ?? 0;
    if (count === 0) {
      try {
        this.fs.writeFile(`${this.dataDir}/${gamePath}`, await this.readGameFile(gamePath));
      } catch {
        return;
      }
    }
    this.users.set(gamePath, count + 1);
  }

  release(path: string): void {
    const gamePath = this.gamePath(path);
    const count = this.users.get(gamePath);
    if (count === undefined) return;
    if (count > 1) {
      this.users.set(gamePath, count - 1);
      return;
    }
    this.users.delete(gamePath);
    this.fs.unlink(`${this.dataDir}/${gamePath}`);
  }
}
