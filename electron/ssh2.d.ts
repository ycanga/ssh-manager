declare module 'ssh2' {
  export class Client {
    on(event: 'ready', cb: () => void): this;
    on(event: 'error', cb: (err: unknown) => void): this;
    shell(options: any, cb: (err: unknown, stream: any) => void): void;
    connect(cfg: any): void;
    end(): void;
  }
}
