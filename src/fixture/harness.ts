// The tier-3 harness (TEST-ARCHITECTURE §3.3) over the domain-state fixture format (§4).
// Until the contract package ships a schema for a whole fixture file, the header and step shapes
// are checked here and an `admitted` block against the package's schema (c123-server#440).
import { Ajv2020 } from 'ajv/dist/2020.js'
import type { WsMessage } from '@opencanoetiming/c123-contract'
import contractPackage from '@opencanoetiming/c123-contract/package.json'
import admittedSchema from '@opencanoetiming/c123-contract/schemas/fixture-admitted.schema.json'
import { createFakeClock, type FakeClock } from '../clock/fakeClock'
import type { StoreState } from '../store/store'
import { createStepper } from './stepper'

/** The contract a fixture must have been produced against: the pinned package's version (c123-server#440). */
export const PINNED_CONTRACT: string = contractPackage.version

export type HydrationStep = {
  kind: 'hydration'
  observedAt: string
  asOfSeq: number
  responses: Record<string, unknown> // §7.1 bodies keyed by GET path
}
export type DeltaStep = WsMessage & { observedAt: string }

export type Fixture = {
  fixtureId: string
  source: { kind: 'synthetic'; reason: string }
  domainLayerVersion: { contract: string; generator?: string }
  admitted?: unknown
  asOfSeq?: number
  steps: [HydrationStep, ...DeltaStep[]]
}

// §4: the delta types a fixture may carry, as the package's WsPayload defines them.
const DELTA_TYPES: ReadonlySet<WsMessage['type']> = new Set<WsMessage['type']>([
  'attempt.updated', 'attempt.deleted', 'phase.updated', 'phase.deleted', 'entry.updated', 'class.updated',
  'course.updated', 'standing.updated', 'oncourse.updated', 'scope.replaced', 'event.changed', 'write.updated',
  'sources.updated', 'diagnostics.updated', 'check.updated', 'flag.updated',
])

const validateAdmitted = new Ajv2020({ allErrors: true }).compile(admittedSchema)

function fail(id: string, what: string): never {
  throw new Error(`fixture ${id}: ${what}`)
}

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const isTime = (v: unknown): v is string => typeof v === 'string' && !Number.isNaN(Date.parse(v))
const isSeq = (v: unknown): v is number => Number.isInteger(v) && (v as number) >= 0

/** Validates a parsed fixture file and returns it typed; throws on anything the format does not allow. */
export function loadFixture(json: unknown): Fixture {
  if (!isObject(json)) fail('?', 'not an object')
  const id = typeof json.fixtureId === 'string' && json.fixtureId !== '' ? json.fixtureId : fail('?', 'fixtureId missing')

  const source = json.source
  if (!isObject(source) || source.kind !== 'synthetic') fail(id, 'source.kind must be "synthetic"')
  if (typeof source.reason !== 'string' || source.reason.trim() === '') fail(id, 'a synthetic fixture needs a source.reason')

  const version = json.domainLayerVersion
  if (!isObject(version) || typeof version.contract !== 'string') fail(id, 'domainLayerVersion.contract missing')
  if (version.contract !== PINNED_CONTRACT) {
    fail(id, `domainLayerVersion.contract ${version.contract} differs from the pinned contract package ${PINNED_CONTRACT}; re-pin deliberately`)
  }

  if ('admitted' in json && !validateAdmitted(json.admitted)) {
    fail(id, `admitted block does not validate: ${JSON.stringify(validateAdmitted.errors)}`)
  }

  const steps = json.steps
  if (!Array.isArray(steps) || steps.length === 0) fail(id, 'steps missing')
  const [first, ...rest] = steps as unknown[]
  if (!isObject(first) || first.kind !== 'hydration') fail(id, 'the first step must be kind "hydration"')
  if (!isTime(first.observedAt)) fail(id, 'the hydration step needs observedAt')
  if (!isSeq(first.asOfSeq)) fail(id, 'the hydration step needs asOfSeq')
  if (!isObject(first.responses)) fail(id, 'the hydration step needs responses')
  rest.forEach((step, i) => {
    const at = `step ${i + 1}`
    if (!isObject(step)) fail(id, `${at} is not an object`)
    if (!isSeq(step.seq)) fail(id, `${at} needs seq`)
    if (!isTime(step.observedAt)) fail(id, `${at} needs observedAt`)
    if (!DELTA_TYPES.has(step.type as WsMessage['type'])) fail(id, `${at} has type ${String(step.type)}, not a contract delta`)
  })
  return json as unknown as Fixture
}

export type Harness = {
  readonly clock: FakeClock
  readonly state: StoreState
  readonly done: boolean
  /** Advances the clock by the gap to the next step, then applies its delta as the transport would. */
  next(): void
  runToEnd(): void
}

/**
 * Initialises the store from the hydration step, as the subscribe-before-snapshot handshake would,
 * with the fake clock at `observedAt` + `offsetMs`, never at `observedAt` itself (§3.3 step 2).
 */
export function startHarness(fixture: Fixture, options: { offsetMs: number }): Harness {
  if (options.offsetMs === 0) throw new Error('startHarness: the clock offset from observedAt must be non-zero')
  const clock = createFakeClock(Date.parse(fixture.steps[0].observedAt) + options.offsetMs)
  const stepper = createStepper(fixture)

  const next = () => {
    clock.advance(stepper.gapToNext)
    stepper.apply()
  }

  return {
    clock,
    get state() {
      return stepper.state
    },
    get done() {
      return stepper.done
    },
    next,
    runToEnd() {
      while (!stepper.done) next()
    },
  }
}
