import { EventEmitter } from "events";
import type { SwarmEvent } from "./types";

export class StreamBus {
  private emitter = new EventEmitter();
  private buffer: SwarmEvent[] = [];
  private closed = false;

  emit(event: SwarmEvent) {
    if (this.closed) return;
    this.buffer.push(event);
    if (this.buffer.length > 5000) this.buffer.shift();
    this.emitter.emit("event", event);
    if (event.type === "complete" || event.type === "error") {
      this.closed = true;
    }
  }

  isClosed() {
    return this.closed;
  }

  toReadableStream(): ReadableStream<Uint8Array> {
    const enc = new TextEncoder();
    const buffer = this.buffer;
    const emitter = this.emitter;
    const refIsClosed = () => this.closed;

    return new ReadableStream({
      start: (ctrl) => {

        for (const ev of buffer) {
          ctrl.enqueue(enc.encode(`data: ${JSON.stringify(ev)}\n\n`));
        }
        if (refIsClosed()) {
          ctrl.close();
          return;
        }

        const handler = (ev: SwarmEvent) => {
          try {
            ctrl.enqueue(enc.encode(`data: ${JSON.stringify(ev)}\n\n`));
            if (ev.type === "complete" || ev.type === "error") {
              ctrl.close();
              emitter.off("event", handler);
            }
          } catch {
            emitter.off("event", handler);
          }
        };

        emitter.on("event", handler);

        (ctrl as unknown as { _cleanup?: () => void })._cleanup = () => {
          emitter.off("event", handler);
        };
      },
      cancel: () => {

      },
    });
  }
}

const buses = new Map<string, StreamBus>();

export function getOrCreateBus(runId: string): StreamBus {
  let bus = buses.get(runId);
  if (!bus) {
    bus = new StreamBus();
    buses.set(runId, bus);
  }
  return bus;
}

export function getBus(runId: string): StreamBus | null {
  return buses.get(runId) ?? null;
}

export function dropBus(runId: string) {
  buses.delete(runId);
}
