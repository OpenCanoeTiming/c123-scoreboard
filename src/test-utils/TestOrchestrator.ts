/**
 * TestOrchestrator - Orchestrates mock servers and providers for testing
 *
 * This module spawns mock servers as child processes and coordinates
 * provider connections for comparison testing.
 *
 * Usage:
 *   const orchestrator = new TestOrchestrator()
 *   await orchestrator.setup({
 *     recording: '../c123-protocol-docs/recordings/rec-2025-12-28T09-34-10.jsonl',
 *     cliPort: 8091,
 *     tcpPort: 27334,
 *     c123ServerPort: 27124
 *   })
 *   // Connect providers and collect events
 *   await orchestrator.teardown()
 */

import { spawn, ChildProcess } from 'child_process'
import * as path from 'path'

/**
 * Orchestrator configuration
 */
export interface OrchestratorConfig {
  /** Path to JSONL recording file */
  recording: string
  /** Port for mock CLI WebSocket server */
  cliPort?: number
  /** Port for mock Canoe123 TCP server */
  tcpPort?: number
  /** Port for C123 Server (if using external) */
  c123ServerPort?: number
  /** Path to C123 Server executable/script */
  c123ServerPath?: string
  /** Replay speed (0=instant, 1=realtime, N=Nx) */
  speed?: number
  /** Enable verbose logging */
  verbose?: boolean
}

/**
 * Server process info
 */
interface ServerProcess {
  process: ChildProcess
  port: number
  ready: Promise<void>
  readyResolve?: () => void
}

/**
 * TestOrchestrator - Manages mock servers and test infrastructure
 */
export class TestOrchestrator {
  private mockCliServer: ServerProcess | null = null
  private mockTcpServer: ServerProcess | null = null
  private c123Server: ServerProcess | null = null
  private config: OrchestratorConfig | null = null
  private projectRoot: string

  constructor() {
    // Get project root (src/test-utils -> project root)
    this.projectRoot = path.resolve(__dirname, '../..')
  }

  /**
   * Setup test infrastructure
   */
  async setup(config: OrchestratorConfig): Promise<void> {
    this.config = {
      cliPort: 8091,
      tcpPort: 27334,
      c123ServerPort: 27124,
      speed: 0,
      verbose: false,
      ...config,
    }

    const recordingPath = path.resolve(this.projectRoot, config.recording)

    console.log('TestOrchestrator: Setting up test infrastructure')
    console.log(`  Recording: ${recordingPath}`)
    console.log(`  CLI port: ${this.config.cliPort}`)
    console.log(`  TCP port: ${this.config.tcpPort}`)

    // Start mock servers in parallel
    await Promise.all([
      this.startMockCliServer(recordingPath),
      this.startMockTcpServer(recordingPath),
    ])

    // If C123 server path provided, start it too
    if (this.config.c123ServerPath) {
      await this.startC123Server()
    }

    console.log('TestOrchestrator: All servers ready')
  }

  /**
   * Start mock CLI WebSocket server
   */
  private async startMockCliServer(recordingPath: string): Promise<void> {
    const scriptPath = path.join(this.projectRoot, 'scripts/mock-cli-ws.ts')

    const args = [
      scriptPath,
      '--file',
      recordingPath,
      '--port',
      String(this.config!.cliPort),
      '--speed',
      String(this.config!.speed),
      '--no-wait', // Start replay immediately
    ]

    this.mockCliServer = this.spawnServer('tsx', args, this.config!.cliPort!, 'CLI WS')
    await this.mockCliServer.ready
  }

  /**
   * Start mock Canoe123 TCP server
   */
  private async startMockTcpServer(recordingPath: string): Promise<void> {
    const scriptPath = path.join(this.projectRoot, 'scripts/mock-c123-tcp.ts')

    const args = [
      scriptPath,
      '--file',
      recordingPath,
      '--port',
      String(this.config!.tcpPort),
      '--speed',
      String(this.config!.speed),
      '--no-wait', // Start replay immediately
    ]

    this.mockTcpServer = this.spawnServer('tsx', args, this.config!.tcpPort!, 'TCP')
    await this.mockTcpServer.ready
  }

  /**
   * Start C123 Server (connects to mock TCP)
   */
  private async startC123Server(): Promise<void> {
    const c123Path = this.config!.c123ServerPath!

    const args = [
      '--host',
      'localhost',
      '--c123-port',
      String(this.config!.tcpPort),
      '--port',
      String(this.config!.c123ServerPort),
      '--no-discovery', // Don't announce on network
    ]

    this.c123Server = this.spawnServer(c123Path, args, this.config!.c123ServerPort!, 'C123')
    await this.c123Server.ready
  }

  /**
   * Spawn a server process and wait for it to be ready
   */
  private spawnServer(
    command: string,
    args: string[],
    port: number,
    name: string
  ): ServerProcess {
    let readyResolve: () => void
    const ready = new Promise<void>((resolve) => {
      readyResolve = resolve
    })

    const verbose = this.config?.verbose ?? false

    const proc = spawn(command, args, {
      cwd: this.projectRoot,
      stdio: verbose ? 'inherit' : 'pipe',
    })

    const serverProc: ServerProcess = {
      process: proc,
      port,
      ready,
      readyResolve: readyResolve!,
    }

    // Monitor stdout for ready message
    if (!verbose && proc.stdout) {
      proc.stdout.on('data', (data: Buffer) => {
        const output = data.toString()
        // Look for "listening" in output to detect ready state
        if (output.includes('listening') || output.includes('Waiting for')) {
          serverProc.readyResolve?.()
        }
      })
    }

    if (!verbose && proc.stderr) {
      proc.stderr.on('data', (data: Buffer) => {
        console.error(`${name} stderr:`, data.toString())
      })
    }

    proc.on('error', (err) => {
      console.error(`${name} process error:`, err)
    })

    proc.on('exit', (code) => {
      if (code !== 0 && code !== null) {
        console.error(`${name} process exited with code ${code}`)
      }
    })

    // Set a timeout for server readiness
    setTimeout(() => {
      serverProc.readyResolve?.()
    }, 3000)

    return serverProc
  }

  /**
   * Get CLI server URL
   */
  getCliUrl(): string {
    if (!this.config) throw new Error('Orchestrator not set up')
    return `ws://localhost:${this.config.cliPort}`
  }

  /**
   * Get C123 Server URL
   */
  getC123ServerUrl(): string {
    if (!this.config) throw new Error('Orchestrator not set up')
    return `http://localhost:${this.config.c123ServerPort}`
  }

  /**
   * Wait for replay to complete
   * This is approximate - waits for a reasonable time based on message count
   */
  async waitForReplayComplete(estimatedMessages: number = 1000): Promise<void> {
    // For instant replay, messages are sent very quickly
    // For realtime, this could take much longer
    const speed = this.config?.speed ?? 0
    const baseTime = speed === 0 ? 2000 : estimatedMessages * 100 / Math.max(speed, 1)
    const waitTime = Math.min(Math.max(baseTime, 2000), 60000) // 2s - 60s

    console.log(`TestOrchestrator: Waiting ${waitTime}ms for replay...`)
    await new Promise((resolve) => setTimeout(resolve, waitTime))
  }

  /**
   * Teardown test infrastructure
   */
  async teardown(): Promise<void> {
    console.log('TestOrchestrator: Tearing down...')

    const killProcess = (server: ServerProcess | null, name: string): Promise<void> => {
      return new Promise((resolve) => {
        if (!server) {
          resolve()
          return
        }

        const proc = server.process
        if (proc.killed || proc.exitCode !== null) {
          resolve()
          return
        }

        proc.once('exit', () => {
          resolve()
        })

        // Try graceful shutdown first
        proc.kill('SIGTERM')

        // Force kill after timeout
        setTimeout(() => {
          if (!proc.killed && proc.exitCode === null) {
            console.log(`TestOrchestrator: Force killing ${name}`)
            proc.kill('SIGKILL')
          }
          resolve()
        }, 2000)
      })
    }

    await Promise.all([
      killProcess(this.mockCliServer, 'CLI WS'),
      killProcess(this.mockTcpServer, 'TCP'),
      killProcess(this.c123Server, 'C123'),
    ])

    this.mockCliServer = null
    this.mockTcpServer = null
    this.c123Server = null
    this.config = null

    console.log('TestOrchestrator: Teardown complete')
  }

  /**
   * Check if all servers are running
   */
  isRunning(): boolean {
    const checkProcess = (server: ServerProcess | null): boolean => {
      if (!server) return true // Not started = ok
      return !server.process.killed && server.process.exitCode === null
    }

    return (
      checkProcess(this.mockCliServer) &&
      checkProcess(this.mockTcpServer) &&
      checkProcess(this.c123Server)
    )
  }
}

/**
 * Create a simple delay promise
 */
export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
