export { parseGates, calculateTotalPenalty, type GatePenalty } from './parseGates'
export { normalizeCompetitor, normalizeResult, isEmptyCompetitor } from './normalizeCompetitor'
export { detectFinish, isOnCourse, hasFinished } from './detectFinish'
export { parseResults, parseCompetitor } from './parseMessages'
export { CallbackManager } from './CallbackManager'
export {
  transformTopMessage,
  transformCompMessage,
  transformOnCourseMessage,
  transformControlMessage,
  transformTitleMessage,
  transformInfoTextMessage,
  transformDayTimeMessage,
  type TransformOptions,
} from './messageHandlers'
