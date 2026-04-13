import { EventEmitter } from 'node:events';

export class MockWebSocket extends EventEmitter {
  public static readonly OPEN = 1;
  public static readonly CLOSED = 3;

  public readonly OPEN = MockWebSocket.OPEN;
  public readyState = MockWebSocket.OPEN;
  public readonly sent: Buffer[] = [];

  send(data: string | Buffer, options?: unknown): void {
    void options;

    if (this.readyState !== MockWebSocket.OPEN) {
      throw new Error('websocket is not open');
    }

    const normalized = Buffer.isBuffer(data) ? data : Buffer.from(data);
    this.sent.push(normalized);
  }

  close(code = 1000, reason = 'normal closure'): void {
    if (this.readyState === MockWebSocket.CLOSED) {
      return;
    }

    this.readyState = MockWebSocket.CLOSED;
    this.emit('close', code, Buffer.from(reason));
  }

  fail(error = new Error('mock websocket error')): void {
    this.emit('error', error);
  }

  get sentText(): string[] {
    return this.sent.map((buffer) => buffer.toString('utf8'));
  }
}
