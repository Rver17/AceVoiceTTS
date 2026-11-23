export class PlaybackQueue<T> {
  private pending: T[] = [];
  private generation = 0;
  private busy = false;
  constructor(
    private work: (item: T, current: () => boolean) => Promise<void>,
    private silence: () => void,
    private error: (e: unknown) => void,
    private count: (n: number) => void,
  ) {}
  stop() {
    this.generation++;
    this.pending = [];
    this.silence();
    this.count(0);
  }
  add(item: T, latest: boolean) {
    if (latest) this.stop();
    this.pending.push(item);
    this.count(this.pending.length);
    void this.drain();
  }
  private async drain() {
    if (this.busy) return;
    this.busy = true;
    try {
      while (this.pending.length) {
        const item = this.pending.shift()!,
          id = this.generation;
        this.count(this.pending.length);
        try {
          await this.work(item, () => id === this.generation);
        } catch (e) {
          if (id === this.generation) this.error(e);
        }
      }
    } finally {
      this.busy = false;
    }
  }
}
