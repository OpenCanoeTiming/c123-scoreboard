#!/usr/bin/env npx ts-node
/**
 * Mock WebSocket server simulating CLI (canoe-scoreboard-cli).
 *
 * Reads a JSONL recording file and replays WebSocket messages to connected clients.
 * Scoreboard's CLIProvider can connect to this mock server and receive data as if
 * it was connected to a real CLI server.
 *
 * Usage:
 *   npx ts-node scripts/mock-cli-ws.ts --file <recording.jsonl> [--port 8081] [--speed 0]
 *
 * Options:
 *   --file, -f    Path to JSONL recording file (required)
 *   --port, -p    WebSocket port to listen on (default: 8081)
 *   --speed, -s   Replay speed: 0=instant, 1=realtime, N=Nx faster (default: 0)
 *   --loop, -l    Loop replay indefinitely
 *   --wait, -w    Wait for client before starting replay (default: true)
 *
 * Example:
 *   npx ts-node scripts/mock-cli-ws.ts -f ../analysis/recordings/rec-2025-12-28T09-34-10.jsonl -s 10
 */

import { WebSocketServer, WebSocket } from 'ws';
import * as http from 'node:http';
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

const DEFAULT_PORT = 8081;

interface MockServerOptions {
  port: number;
  speed: number;
  loop: boolean;
  waitForClient: boolean;
}

class MockCLIWebSocketServer {
  private server: http.Server | null = null;
  private wss: WebSocketServer | null = null;
  private clients: Set<WebSocket> = new Set();
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

    this.messages = await loadRecording(absolutePath, { filterSrc: 'ws' });
    console.log(`  Loaded ${this.messages.length} WebSocket messages`);

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
   * Start the WebSocket server
   */
  async start(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.server = http.createServer();

      this.wss = new WebSocketServer({ server: this.server });

      this.wss.on('connection', (ws, req) => {
        this.handleClient(ws, req);
      });

      this.wss.on('error', (err) => {
        console.error('WebSocket server error:', err);
        reject(err);
      });

      this.server.listen(this.options.port, () => {
        console.log(
          `\nMock CLI WebSocket server listening on port ${this.options.port}`
        );
        console.log(`  ws://localhost:${this.options.port}/`);
        console.log('Waiting for scoreboard to connect...\n');
        resolve();
      });

      this.server.on('error', (err) => {
        console.error('HTTP server error:', err);
        reject(err);
      });
    });
  }

  /**
   * Handle new client connection
   */
  private handleClient(ws: WebSocket, req: http.IncomingMessage): void {
    const clientAddr = req.socket.remoteAddress;
    console.log(`Client connected: ${clientAddr}`);
    this.clients.add(ws);

    ws.on('close', () => {
      console.log(`Client disconnected: ${clientAddr}`);
      this.clients.delete(ws);
    });

    ws.on('error', (err) => {
      console.error(`Client error (${clientAddr}):`, err.message);
      this.clients.delete(ws);
    });

    // Start replay when first client connects (if waiting)
    if (this.options.waitForClient && !this.isReplaying) {
      this.startReplay();
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

    // CLI sends JSON messages - the data field already contains the full message
    const data =
      typeof msg.data === 'string' ? msg.data : JSON.stringify(msg.data);

    for (const client of this.clients) {
      if (client.readyState === WebSocket.OPEN) {
        try {
          client.send(data);
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
      client.close();
    }
    this.clients.clear();

    this.wss?.close();
    this.server?.close();
    this.wss = null;
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
      '\nUsage: npx ts-node scripts/mock-cli-ws.ts --file <recording.jsonl> [options]'
    );
    console.error('\nOptions:');
    console.error('  --file, -f    Path to JSONL recording file (required)');
    console.error('  --port, -p    WebSocket port (default: 8081)');
    console.error('  --speed, -s   Replay speed: 0=instant, 1=realtime');
    console.error('  --loop, -l    Loop replay indefinitely');
    console.error('  --no-wait     Start replay immediately');
    process.exit(1);
  }

  const server = new MockCLIWebSocketServer({
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
