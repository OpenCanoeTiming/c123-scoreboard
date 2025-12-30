#!/usr/bin/env node
/**
 * C123 WebSocket Proxy
 *
 * Bridges TCP connection to Canoe123 (port 27333) to WebSocket for browser access.
 * The browser cannot directly connect to TCP sockets, so this proxy is required.
 *
 * Usage:
 *   node scripts/c123-proxy.js [c123-host] [ws-port]
 *   node scripts/c123-proxy.js 192.168.68.108 8082
 *
 * Default:
 *   C123 host: 192.168.68.108
 *   WS port: 8082
 *
 * Protocol:
 *   - Connects to C123 TCP:27333
 *   - Exposes WebSocket server on specified port
 *   - Forwards XML messages (pipe-delimited) as-is to WebSocket clients
 *   - Supports multiple WebSocket clients
 */

const net = require('net');
const WebSocket = require('ws');

// Configuration
const C123_HOST = process.argv[2] || '192.168.68.108';
const C123_PORT = 27333;
const WS_PORT = parseInt(process.argv[3], 10) || 8082;

// State
let tcpSocket = null;
let tcpBuffer = '';
let reconnectTimeout = null;
let reconnectDelay = 1000;
const MAX_RECONNECT_DELAY = 30000;

// WebSocket server
const wss = new WebSocket.Server({ port: WS_PORT });
const clients = new Set();

console.log('');
console.log('╔══════════════════════════════════════════════════════════════╗');
console.log('║              C123 WebSocket Proxy                            ║');
console.log('╚══════════════════════════════════════════════════════════════╝');
console.log('');
console.log(`🎯 C123 host: ${C123_HOST}:${C123_PORT}`);
console.log(`🌐 WebSocket: ws://localhost:${WS_PORT}`);
console.log('');

// WebSocket server handlers
wss.on('listening', () => {
  console.log(`✅ WebSocket server listening on port ${WS_PORT}`);
  connectToC123();
});

wss.on('connection', (ws, req) => {
  const clientIp = req.socket.remoteAddress;
  clients.add(ws);
  console.log(`📱 Client connected: ${clientIp} (${clients.size} total)`);

  ws.on('close', () => {
    clients.delete(ws);
    console.log(`📴 Client disconnected: ${clientIp} (${clients.size} total)`);
  });

  ws.on('error', (err) => {
    console.error(`⚠️  Client error: ${err.message}`);
    clients.delete(ws);
  });
});

wss.on('error', (err) => {
  console.error(`❌ WebSocket server error: ${err.message}`);
  process.exit(1);
});

// TCP connection to C123
function connectToC123() {
  if (tcpSocket) {
    tcpSocket.destroy();
    tcpSocket = null;
  }

  console.log(`🔌 Connecting to C123 at ${C123_HOST}:${C123_PORT}...`);

  tcpSocket = new net.Socket();
  tcpBuffer = '';

  tcpSocket.connect(C123_PORT, C123_HOST, () => {
    console.log('✅ Connected to C123');
    reconnectDelay = 1000; // Reset backoff

    // Notify clients
    broadcast(JSON.stringify({
      type: 'proxy_status',
      status: 'connected',
      host: C123_HOST,
      port: C123_PORT,
    }));
  });

  tcpSocket.on('data', (data) => {
    const text = data.toString('utf8');
    tcpBuffer += text;

    // Split by pipe delimiter
    const messages = tcpBuffer.split('|');
    tcpBuffer = messages.pop(); // Keep incomplete message in buffer

    for (const msg of messages) {
      if (!msg.trim()) continue;
      // Forward XML message to all clients
      broadcast(msg.trim());
    }
  });

  tcpSocket.on('close', () => {
    console.log('⚠️  Disconnected from C123');
    tcpSocket = null;

    // Notify clients
    broadcast(JSON.stringify({
      type: 'proxy_status',
      status: 'disconnected',
    }));

    scheduleReconnect();
  });

  tcpSocket.on('error', (err) => {
    console.error(`❌ C123 connection error: ${err.message}`);
    // close event will trigger reconnect
  });
}

function broadcast(message) {
  for (const client of clients) {
    if (client.readyState === WebSocket.OPEN) {
      try {
        client.send(message);
      } catch (err) {
        console.error(`⚠️  Failed to send to client: ${err.message}`);
      }
    }
  }
}

function scheduleReconnect() {
  if (reconnectTimeout) return;

  console.log(`⏳ Reconnecting in ${reconnectDelay / 1000}s...`);

  reconnectTimeout = setTimeout(() => {
    reconnectTimeout = null;
    connectToC123();
  }, reconnectDelay);

  // Exponential backoff
  reconnectDelay = Math.min(reconnectDelay * 2, MAX_RECONNECT_DELAY);
}

// Cleanup
process.on('SIGINT', () => {
  console.log('\n👋 Shutting down...');

  if (tcpSocket) {
    tcpSocket.destroy();
  }

  wss.close(() => {
    console.log('✅ Proxy stopped');
    process.exit(0);
  });
});

process.on('SIGTERM', () => {
  process.emit('SIGINT');
});
