#!/usr/bin/env npx ts-node
/**
 * Mock TCP server simulating Canoe123 timing system.
 *
 * Reads a JSONL recording file and replays TCP messages to connected clients.
 * C123 Server can connect to this mock server and receive data as if it was
 * connected to a real Canoe123 timing system.
 *
 * Usage:
 *   npx ts-node scripts/mock-c123-tcp.ts --file <recording.jsonl> [--port 27333] [--speed 0]
 *
 * Options:
 *   --file, -f    Path to JSONL recording file (required)
 *   --port, -p    TCP port to listen on (default: 27333)
 *   --speed, -s   Replay speed: 0=instant, 1=realtime, N=Nx faster (default: 0)
 *   --loop, -l    Loop replay indefinitely
 *   --wait, -w    Wait for client before starting replay (default: true)
 *
 * Example:
 *   npx ts-node scripts/mock-c123-tcp.ts -f ../analysis/recordings/rec-2025-12-28T09-34-10.jsonl -s 10
 */

import * as net from 'node:net';
import * as path from 'node:path';
import {
  loadRecording,
  loadRecordingMeta,
  replayMessages,
  parseSpeedArg,
  parseFileArg,
  parsePortArg,
  type RecordedMessage,
} from './lib/recording-loader.ts';

const DEFAULT_PORT = 27333;

interface MockServerOptions {
  port: number;
  speed: number;
  loop: boolean;
  waitForClient: boolean;
}

class MockC123TcpServer {
  private server: net.Server | null = null;
  private clients: Set<net.Socket> = new Set();
  private messages: RecordedMessage[] = [];
  private abortController: AbortController | null = null;
  private options: MockServerOptions;
  private isReplaying = false;

  constructor(options: Partial<MockServerOptions> = {}) {
    this.options = {
      port: options.port ?? DEFAULT_PORT,
      speed: options.speed ?? 0,
      loop: options.loop ?? false,
      waitForClient: options.waitForClient ?? true,
    };
  }

  /**
   * Load recording file
   */
  async loadRecording(filePath: string): Promise<void> {
    const absolutePath = path.resolve(filePath);
    console.log(`Loading recording from: ${absolutePath}`);

    const meta = await loadRecordingMeta(absolutePath);
    if (meta) {
      console.log(`  Recording date: ${meta.recorded}`);
      console.log(`  Original host: ${meta.host}`);
    }

    this.messages = await loadRecording(absolutePath, { filterSrc: 'tcp' });
    console.log(`  Loaded ${this.messages.length} TCP messages`);

    // Show message type distribution
    const typeCounts = new Map<string, number>();
    for (const msg of this.messages) {
      typeCounts.set(msg.type, (typeCounts.get(msg.type) ?? 0) + 1);
    }
    console.log('  Message types:');
    for (const [type, count] of typeCounts) {
      console.log(`    ${type}: ${count}`);
    }
  }

  /**
   * Start the TCP server
   */
  async start(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.server = net.createServer((socket) => {
        this.handleClient(socket);
      });

      this.server.on('error', (err) => {
        console.error('Server error:', err);
        reject(err);
      });

      this.server.listen(this.options.port, () => {
        console.log(
          `\nMock Canoe123 TCP server listening on port ${this.options.port}`
        );
        console.log('Waiting for C123 Server to connect...\n');
        resolve();
      });
    });
  }

  /**
   * Handle new client connection
   */
  private handleClient(socket: net.Socket): void {
    const clientAddr = `${socket.remoteAddress}:${socket.remotePort}`;
    console.log(`Client connected: ${clientAddr}`);
    this.clients.add(socket);

    socket.on('close', () => {
      console.log(`Client disconnected: ${clientAddr}`);
      this.clients.delete(socket);
    });

    socket.on('error', (err) => {
      console.error(`Client error (${clientAddr}):`, err.message);
      this.clients.delete(socket);
    });

    // Start replay when first client connects (if waiting)
    // Add delay to allow C123 server to start and clients to connect to it
    if (this.options.waitForClient && !this.isReplaying) {
      console.log('Client connected, waiting 3s before replay to allow downstream connections...');
      setTimeout(() => this.startReplay(), 3000);
    }
  }

  /**
   * Start replaying messages
   */
  async startReplay(): Promise<void> {
    if (this.isReplaying) return;
    this.isReplaying = true;

    if (this.messages.length === 0) {
      console.log('No messages to replay');
      return;
    }

    const speedLabel =
      this.options.speed === 0
        ? 'instant'
        : this.options.speed === 1
          ? 'realtime'
          : `${this.options.speed}x`;
    console.log(`Starting replay (${speedLabel})...`);

    let replayCount = 0;
    const doReplay = async (): Promise<void> => {
      replayCount++;
      console.log(
        `\n--- Replay #${replayCount} starting (${this.messages.length} messages) ---`
      );

      this.abortController = new AbortController();
      let messageCount = 0;

      await replayMessages(this.messages, {
        speed: this.options.speed,
        signal: this.abortController.signal,
        onMessage: (msg) => {
          this.sendToClients(msg);
          messageCount++;

          // Progress indicator every 100 messages
          if (messageCount % 100 === 0) {
            process.stdout.write(
              `\r  Sent ${messageCount}/${this.messages.length} messages...`
            );
          }
        },
        onComplete: () => {
          console.log(`\n  Replay complete: sent ${messageCount} messages`);
        },
      });
    };

    do {
      await doReplay();

      if (this.options.loop && !this.abortController?.signal.aborted) {
        console.log('Looping replay in 2 seconds...');
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
    } while (this.options.loop && !this.abortController?.signal.aborted);

    console.log('\nReplay finished');
    this.isReplaying = false;
  }

  /**
   * Send message to all connected clients
   */
  private sendToClients(msg: RecordedMessage): void {
    if (this.clients.size === 0) return;

    // Extract data string - Canoe123 sends raw XML followed by pipe delimiter
    const data =
      typeof msg.data === 'string' ? msg.data : JSON.stringify(msg.data);

    // C123 protocol uses pipe (|) as message delimiter
    const dataWithDelimiter = data + '|';

    for (const client of this.clients) {
      if (!client.destroyed) {
        try {
          client.write(dataWithDelimiter);
        } catch (err) {
          console.error('Error sending to client:', err);
        }
      }
    }
  }

  /**
   * Wait for client connection
   */
  async waitForClient(): Promise<void> {
    if (this.clients.size > 0) return;

    return new Promise((resolve) => {
      const checkInterval = setInterval(() => {
        if (this.clients.size > 0) {
          clearInterval(checkInterval);
          resolve();
        }
      }, 100);
    });
  }

  /**
   * Stop the server
   */
  stop(): void {
    console.log('\nStopping server...');

    this.abortController?.abort();

    for (const client of this.clients) {
      client.destroy();
    }
    this.clients.clear();

    this.server?.close();
    this.server = null;
  }
}

// Main entry point
async function main(): Promise<void> {
  const args = process.argv.slice(2);

  // Parse arguments
  const filePath = parseFileArg(args);
  const port = parsePortArg(args, DEFAULT_PORT);
  const speed = parseSpeedArg(args);
  const loop = args.includes('--loop') || args.includes('-l');
  const noWait = args.includes('--no-wait');

  if (!filePath) {
    console.error('Error: Recording file path is required');
    console.error(
      '\nUsage: npx ts-node scripts/mock-c123-tcp.ts --file <recording.jsonl> [options]'
    );
    console.error('\nOptions:');
    console.error('  --file, -f    Path to JSONL recording file (required)');
    console.error('  --port, -p    TCP port (default: 27333)');
    console.error('  --speed, -s   Replay speed: 0=instant, 1=realtime');
    console.error('  --loop, -l    Loop replay indefinitely');
    console.error('  --no-wait     Start replay immediately');
    process.exit(1);
  }

  const server = new MockC123TcpServer({
    port,
    speed,
    loop,
    waitForClient: !noWait,
  });

  // Handle shutdown
  process.on('SIGINT', () => {
    server.stop();
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    server.stop();
    process.exit(0);
  });

  try {
    await server.loadRecording(filePath);
    await server.start();

    if (noWait) {
      await server.startReplay();
    }

    // Keep running
    await new Promise(() => {});
  } catch (err) {
    console.error('Fatal error:', err);
    process.exit(1);
  }
}

main();
