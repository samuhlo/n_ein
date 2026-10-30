export class Registry {
  active = new Map<string, Promise<unknown>>();
  async run(key: string, work: () => Promise<unknown>) {
    const pending = Promise.resolve().then(work);
    this.active.set(key, pending);
    try { return await pending; }
    finally { this.active.delete(key); }
  }
}
