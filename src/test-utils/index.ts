/**
 * Test utilities for provider comparison testing
 *
 * Provides tools for:
 * - Collecting events from DataProviders
 * - Comparing events between providers
 * - Orchestrating mock servers for replay testing
 */

export { EventCollector } from './EventCollector'
export type {
  CollectedEvent,
  NormalizedEvents,
  NormalizedResult,
  NormalizedOnCourse,
} from './EventCollector'

export { compareEvents, formatComparisonResult } from './EventComparator'
export type {
  ComparisonResult,
  ComparisonOptions,
  FieldDiff,
  ResultDiff,
  OnCourseDiff,
} from './EventComparator'

export { TestOrchestrator, delay } from './TestOrchestrator'
export type { OrchestratorConfig } from './TestOrchestrator'
