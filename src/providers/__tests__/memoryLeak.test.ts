/**
 * Memory leak tests for DataProviders
 *
 * These tests verify that providers properly clean up resources
 * when disconnected and don't accumulate memory over multiple
 * connect/disconnect cycles.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ReplayProvider } from '../ReplayProvider';

// Sample JSONL data for testing - matches expected WebSocket message format
const createTestJSONL = (messageCount: number): string => {
  const lines: string[] = [
    JSON.stringify({ _meta: { recordingStart: Date.now(), version: '1.0' } }),
  ];

  for (let i = 0; i < messageCount; i++) {
    lines.push(JSON.stringify({
      ts: i * 100,
      src: 'ws',  // 'src' not 'source'
      type: 'top',
      data: {
        msg: 'top',
        data: {
          HighlightBib: 0,
          Results: Array.from({ length: 20 }, (_, j) => ({
            Rank: j + 1,
            Bib: String(100 + j),
            Name: `Competitor ${j}`,
            Club: `Club ${j}`,
            Time: `${90 + j}.${String(j * 3).padStart(2, '0')}`,
            Behind: j === 0 ? '' : `+${j}.00`,
            Pen: j % 3 === 0 ? 2 : 0,
          })),
        },
      },
    }));
  }

  return lines.join('\n');
};

describe('ReplayProvider memory management', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should clean up all timers on disconnect', async () => {
    const jsonl = createTestJSONL(100);
    const provider = new ReplayProvider(jsonl, { speed: 100 });

    const resultsCallback = vi.fn();
    provider.onResults(resultsCallback);

    await provider.connect();

    // Let some messages process
    vi.advanceTimersByTime(500);
    expect(resultsCallback).toHaveBeenCalled();

    // Disconnect should clear all timers
    provider.disconnect();

    // Verify no more callbacks after disconnect
    const callCountAfterDisconnect = resultsCallback.mock.calls.length;
    vi.advanceTimersByTime(10000);

    expect(resultsCallback.mock.calls.length).toBe(callCountAfterDisconnect);
  });

  it('should clean up subscriptions properly', async () => {
    const jsonl = createTestJSONL(10);
    const provider = new ReplayProvider(jsonl, { speed: 1000 });

    const callbacks = {
      results: vi.fn(),
      onCourse: vi.fn(),
      config: vi.fn(),
      connection: vi.fn(),
      error: vi.fn(),
    };

    // Subscribe
    const unsubResults = provider.onResults(callbacks.results);
    const unsubOnCourse = provider.onOnCourse(callbacks.onCourse);
    const unsubConfig = provider.onConfig(callbacks.config);
    const unsubConnection = provider.onConnectionChange(callbacks.connection);
    const unsubError = provider.onError(callbacks.error);

    await provider.connect();
    vi.advanceTimersByTime(100);

    // Unsubscribe all
    unsubResults();
    unsubOnCourse();
    unsubConfig();
    unsubConnection();
    unsubError();

    const callCounts = {
      results: callbacks.results.mock.calls.length,
      onCourse: callbacks.onCourse.mock.calls.length,
      config: callbacks.config.mock.calls.length,
      connection: callbacks.connection.mock.calls.length,
      error: callbacks.error.mock.calls.length,
    };

    // Advance time - no more callbacks should fire
    vi.advanceTimersByTime(10000);

    expect(callbacks.results.mock.calls.length).toBe(callCounts.results);
    expect(callbacks.onCourse.mock.calls.length).toBe(callCounts.onCourse);
    expect(callbacks.config.mock.calls.length).toBe(callCounts.config);
    expect(callbacks.connection.mock.calls.length).toBe(callCounts.connection);
    expect(callbacks.error.mock.calls.length).toBe(callCounts.error);

    provider.disconnect();
  });

  it('should handle multiple connect/disconnect cycles without issues', async () => {
    const jsonl = createTestJSONL(50);
    const cycles = 100;

    for (let i = 0; i < cycles; i++) {
      const provider = new ReplayProvider(jsonl, { speed: 1000 });
      const callback = vi.fn();

      provider.onResults(callback);
      await provider.connect();

      // Quick playback
      vi.advanceTimersByTime(100);

      provider.disconnect();

      // Verify disconnected state
      expect(provider.connected).toBe(false);
      expect(provider.status).toBe('disconnected');
    }

    // If we got here without errors or memory issues, test passes
    expect(true).toBe(true);
  });

  it('should handle rapid connect/disconnect without race conditions', async () => {
    const jsonl = createTestJSONL(20);
    const provider = new ReplayProvider(jsonl, { speed: 1000 });

    const connectionCallback = vi.fn();
    provider.onConnectionChange(connectionCallback);

    // Rapid connect/disconnect cycles
    for (let i = 0; i < 50; i++) {
      const connectPromise = provider.connect();
      provider.disconnect();

      // Don't await - test concurrent behavior
      try {
        await connectPromise;
      } catch {
        // May fail due to disconnect - that's expected
      }
    }

    // Final state should be disconnected
    expect(provider.status).toBe('disconnected');
  });

  it('should not accumulate callbacks across reconnections', async () => {
    const jsonl = createTestJSONL(10);
    const provider = new ReplayProvider(jsonl, { speed: 1000 });

    const callback = vi.fn();

    // Connect multiple times with same callback
    for (let i = 0; i < 10; i++) {
      provider.onResults(callback);
      await provider.connect();
      vi.advanceTimersByTime(50);
      provider.disconnect();
    }

    // Reconnect one more time
    await provider.connect();
    callback.mockClear();

    vi.advanceTimersByTime(50);

    // Each message should only fire callback once (not 10x)
    const callCount = callback.mock.calls.length;

    provider.disconnect();

    // Should be reasonable number (depends on message timing)
    // The key is it shouldn't be 10x what we'd expect
    expect(callCount).toBeLessThan(100);
  });

  it('should properly clean up pause/resume state', async () => {
    const jsonl = createTestJSONL(20);
    const provider = new ReplayProvider(jsonl, { speed: 10 });

    const callback = vi.fn();
    provider.onResults(callback);

    await provider.connect();

    // Pause/resume cycles
    for (let i = 0; i < 20; i++) {
      provider.pause();
      vi.advanceTimersByTime(100);
      provider.resume();
      vi.advanceTimersByTime(100);
    }

    provider.disconnect();

    // Should be disconnected with no lingering timers
    const callCountAfterDisconnect = callback.mock.calls.length;
    vi.advanceTimersByTime(10000);

    expect(callback.mock.calls.length).toBe(callCountAfterDisconnect);
  });

  it('should clean up after seek operations', async () => {
    const jsonl = createTestJSONL(50);
    const provider = new ReplayProvider(jsonl, { speed: 10 });

    const callback = vi.fn();
    provider.onResults(callback);

    await provider.connect();

    // Many seek operations
    for (let i = 0; i < 30; i++) {
      provider.seek(i * 100);
      vi.advanceTimersByTime(50);
    }

    provider.disconnect();

    const callCountAfterDisconnect = callback.mock.calls.length;
    vi.advanceTimersByTime(10000);

    expect(callback.mock.calls.length).toBe(callCountAfterDisconnect);
  });

  it('should handle speed changes without timer leaks', async () => {
    const jsonl = createTestJSONL(30);
    const provider = new ReplayProvider(jsonl, { speed: 1 });

    const callback = vi.fn();
    provider.onResults(callback);

    await provider.connect();

    // Rapid speed changes
    for (let i = 0; i < 50; i++) {
      provider.setSpeed(Math.random() * 100 + 0.1);
      vi.advanceTimersByTime(10);
    }

    provider.disconnect();

    const callCountAfterDisconnect = callback.mock.calls.length;
    vi.advanceTimersByTime(10000);

    expect(callback.mock.calls.length).toBe(callCountAfterDisconnect);
  });
});

describe('ReplayProvider large data handling', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should handle large message count efficiently', async () => {
    const jsonl = createTestJSONL(1000);
    const provider = new ReplayProvider(jsonl, { speed: 10000 });

    const callback = vi.fn();
    provider.onResults(callback);

    await provider.connect();

    // Process all messages
    vi.advanceTimersByTime(100000);

    provider.disconnect();

    // Should have processed many messages
    expect(callback.mock.calls.length).toBeGreaterThan(0);
  });

  it('should handle large result arrays', async () => {
    // Create JSONL with very large result arrays - matches expected format
    const lines: string[] = [
      JSON.stringify({ _meta: { recordingStart: Date.now(), version: '1.0' } }),
    ];

    for (let i = 0; i < 10; i++) {
      lines.push(JSON.stringify({
        ts: i * 100,
        src: 'ws',  // 'src' not 'source'
        type: 'top',
        data: {
          msg: 'top',
          data: {
            HighlightBib: 0,
            Results: Array.from({ length: 500 }, (_, j) => ({
              Rank: j + 1,
              Bib: String(1000 + j),
              Name: `Very Long Competitor Name That Takes Up Space ${j}`,
              Club: `International Club Association ${j}`,
              Time: `${90 + j}.${String(j * 3).padStart(2, '0')}`,
              Behind: j === 0 ? '' : `+${j}.00`,
              Pen: j % 3 === 0 ? 2 : j % 7 === 0 ? 50 : 0,
            })),
          },
        },
      }));
    }

    const jsonl = lines.join('\n');
    const provider = new ReplayProvider(jsonl, { speed: 100 });

    const callback = vi.fn();
    provider.onResults(callback);

    await provider.connect();
    vi.advanceTimersByTime(5000);

    provider.disconnect();

    // Verify we received results - structure may be validated/filtered by provider
    expect(callback).toHaveBeenCalled();
    const lastCall = callback.mock.calls[callback.mock.calls.length - 1];
    // Results are provided in the callback
    expect(lastCall[0]).toHaveProperty('results');
  });
});
