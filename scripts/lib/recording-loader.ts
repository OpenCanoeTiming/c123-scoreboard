/**
 * Shared library for loading and parsing JSONL recording files.
 * Used by both mock-c123-tcp and mock-cli-ws servers.
 */

import * as fs from 'node:fs';
import * as readline from 'node:readline';

/**
 * Recording metadata from the first line of the JSONL file
 */
export interface RecordingMeta {
  version: number;
  recorded: string;
  host: string;
  sources: {
    tcp?: string;
    ws?: string;
    udp27333?: string;
    udp10600?: string;
  };
}

/**
 * Single recorded message from JSONL file
 */
export interface RecordedMessage {
  ts: number; // timestamp in milliseconds from recording start
  src: 'tcp' | 'ws' | 'udp27333' | 'udp10600';
  type: string;
  data: unknown;
}

/**
 * Options for loading recordings
 */
export interface LoadOptions {
  filterSrc?: string | string[]; // Filter by source (e.g., 'tcp', 'ws')
}

/**
 * Options for replaying recordings
 */
export interface ReplayOptions {
  speed?: number; // 0 = instant, 1 = realtime, N = Nx faster
  onMessage?: (msg: RecordedMessage) => void;
  onComplete?: () => void;
  signal?: AbortSignal; // For cancellation
}

/**
 * Load recording metadata from JSONL file
 */
export async function loadRecordingMeta(
  filePath: string
): Promise<RecordingMeta | null> {
  const stream = fs.createReadStream(filePath, { encoding: 'utf8' });
  const rl = readline.createInterface({ input: stream });

  for await (const line of rl) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    try {
      const parsed = JSON.parse(trimmed);
      if (parsed._meta) {
        rl.close();
        return parsed._meta;
      }
    } catch {
      // Skip invalid lines
    }
    rl.close();
    break;
  }

  return null;
}

/**
 * Load all messages from recording file
 */
export async function loadRecording(
  filePath: string,
  options: LoadOptions = {}
): Promise<RecordedMessage[]> {
  const messages: RecordedMessage[] = [];
  const filterSrcs = options.filterSrc
    ? Array.isArray(options.filterSrc)
      ? options.filterSrc
      : [options.filterSrc]
    : null;

  const stream = fs.createReadStream(filePath, { encoding: 'utf8' });
  const rl = readline.createInterface({ input: stream });

  for await (const line of rl) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    try {
      const parsed = JSON.parse(trimmed);

      // Skip metadata line
      if (parsed._meta) continue;

      // Must have required fields
      if (typeof parsed.ts !== 'number' || !parsed.src || !parsed.type) {
        continue;
      }

      // Filter by source if specified
      if (filterSrcs && !filterSrcs.includes(parsed.src)) {
        continue;
      }

      messages.push(parsed as RecordedMessage);
    } catch {
      // Skip invalid lines
    }
  }

  // Sort by timestamp (should already be sorted, but ensure)
  messages.sort((a, b) => a.ts - b.ts);

  return messages;
}

/**
 * Replay messages with timing control
 * Returns a promise that resolves when replay is complete
 */
export async function replayMessages(
  messages: RecordedMessage[],
  options: ReplayOptions = {}
): Promise<void> {
  const { speed = 1, onMessage, onComplete, signal } = options;

  if (messages.length === 0) {
    onComplete?.();
    return;
  }

  const startTs = messages[0].ts;
  const startTime = Date.now();

  for (const msg of messages) {
    // Check for cancellation
    if (signal?.aborted) {
      return;
    }

    if (speed > 0) {
      // Calculate delay based on speed
      const relativeTs = msg.ts - startTs;
      const targetTime = startTime + relativeTs / speed;
      const delay = targetTime - Date.now();

      if (delay > 0) {
        await sleep(delay, signal);
        if (signal?.aborted) return;
      }
    }

    onMessage?.(msg);
  }

  onComplete?.();
}

/**
 * Sleep helper with abort signal support
 */
function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      resolve();
      return;
    }

    const timeout = setTimeout(resolve, ms);

    signal?.addEventListener(
      'abort',
      () => {
        clearTimeout(timeout);
        resolve();
      },
      { once: true }
    );
  });
}

/**
 * Parse command line arguments for replay speed
 */
export function parseSpeedArg(args: string[]): number {
  const speedIdx = args.findIndex((a) => a === '--speed' || a === '-s');
  if (speedIdx !== -1 && args[speedIdx + 1]) {
    const speed = parseFloat(args[speedIdx + 1]);
    if (!isNaN(speed) && speed >= 0) {
      return speed;
    }
  }
  return 0; // Default: instant replay
}

/**
 * Parse command line arguments for file path
 */
export function parseFileArg(args: string[]): string | null {
  const fileIdx = args.findIndex((a) => a === '--file' || a === '-f');
  if (fileIdx !== -1 && args[fileIdx + 1]) {
    return args[fileIdx + 1];
  }
  return null;
}

/**
 * Parse command line arguments for port
 */
export function parsePortArg(args: string[], defaultPort: number): number {
  const portIdx = args.findIndex((a) => a === '--port' || a === '-p');
  if (portIdx !== -1 && args[portIdx + 1]) {
    const port = parseInt(args[portIdx + 1], 10);
    if (!isNaN(port) && port > 0 && port < 65536) {
      return port;
    }
  }
  return defaultPort;
}
