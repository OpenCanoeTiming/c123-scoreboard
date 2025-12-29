/**
 * Validation utilities for WebSocket message parsing
 *
 * These functions provide runtime type checking and validation
 * for incoming WebSocket messages to ensure data integrity.
 */

/**
 * Validation result with optional error message
 */
export interface ValidationResult {
  valid: boolean
  error?: string
}

/**
 * Validates that a value is a non-null object
 */
export function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * Validates that a value is an array
 */
export function isArray(value: unknown): value is unknown[] {
  return Array.isArray(value)
}

/**
 * Validates that a value is a string
 */
export function isString(value: unknown): value is string {
  return typeof value === 'string'
}

/**
 * Validates that a value is a number (including numeric strings)
 */
export function isNumeric(value: unknown): boolean {
  if (typeof value === 'number') return !isNaN(value)
  if (typeof value === 'string') return !isNaN(Number(value)) && value.trim() !== ''
  return false
}

/**
 * Safely converts a value to string
 */
export function safeString(value: unknown, defaultValue: string = ''): string {
  if (value === null || value === undefined) return defaultValue
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  return defaultValue
}

/**
 * Safely converts a value to number
 */
export function safeNumber(value: unknown, defaultValue: number = 0): number {
  if (typeof value === 'number') return isNaN(value) ? defaultValue : value
  if (typeof value === 'string') {
    const num = Number(value)
    return isNaN(num) ? defaultValue : num
  }
  return defaultValue
}

/**
 * Safely converts a value to string for error messages
 */
function safeStringify(value: unknown): string {
  if (value === null) return 'null'
  if (value === undefined) return 'undefined'
  if (typeof value === 'symbol') return value.toString()
  if (typeof value === 'bigint') return value.toString()
  try {
    return String(value)
  } catch {
    return '[unstringifiable]'
  }
}

/**
 * Validates CLI 'top' message structure
 */
export function validateTopMessage(message: unknown): ValidationResult {
  if (!isObject(message)) {
    return { valid: false, error: 'Message must be an object' }
  }

  const msg = message.msg || message.type
  if (msg !== 'top') {
    return { valid: false, error: `Invalid message type: ${safeStringify(msg)}` }
  }

  if (!isObject(message.data)) {
    return { valid: false, error: 'Message data must be an object' }
  }

  const data = message.data as Record<string, unknown>

  // list is optional but if present must be an array
  if (data.list !== undefined && !isArray(data.list)) {
    return { valid: false, error: 'list must be an array' }
  }

  return { valid: true }
}

/**
 * Validates CLI 'comp' message structure
 */
export function validateCompMessage(message: unknown): ValidationResult {
  if (!isObject(message)) {
    return { valid: false, error: 'Message must be an object' }
  }

  const msg = message.msg || message.type
  if (msg !== 'comp') {
    return { valid: false, error: `Invalid message type: ${safeStringify(msg)}` }
  }

  if (!isObject(message.data)) {
    return { valid: false, error: 'Message data must be an object' }
  }

  return { valid: true }
}

/**
 * Validates CLI 'oncourse' message structure
 */
export function validateOnCourseMessage(message: unknown): ValidationResult {
  if (!isObject(message)) {
    return { valid: false, error: 'Message must be an object' }
  }

  const msg = message.msg || message.type
  if (msg !== 'oncourse') {
    return { valid: false, error: `Invalid message type: ${safeStringify(msg)}` }
  }

  if (!isArray(message.data)) {
    return { valid: false, error: 'Message data must be an array' }
  }

  return { valid: true }
}

/**
 * Validates CLI 'control' message structure
 */
export function validateControlMessage(message: unknown): ValidationResult {
  if (!isObject(message)) {
    return { valid: false, error: 'Message must be an object' }
  }

  const msg = message.msg || message.type
  if (msg !== 'control') {
    return { valid: false, error: `Invalid message type: ${safeStringify(msg)}` }
  }

  if (!isObject(message.data)) {
    return { valid: false, error: 'Message data must be an object' }
  }

  return { valid: true }
}

/**
 * Validates CLI 'title', 'infotext', 'daytime' message structure
 */
export function validateTextMessage(
  message: unknown,
  expectedType: 'title' | 'infotext' | 'daytime'
): ValidationResult {
  if (!isObject(message)) {
    return { valid: false, error: 'Message must be an object' }
  }

  const msg = message.msg || message.type
  if (msg !== expectedType) {
    return { valid: false, error: `Invalid message type: ${safeStringify(msg)}` }
  }

  if (!isObject(message.data)) {
    return { valid: false, error: 'Message data must be an object' }
  }

  return { valid: true }
}

/**
 * Validates a result row from 'top' message
 */
export function validateResultRow(row: unknown): ValidationResult {
  if (!isObject(row)) {
    return { valid: false, error: 'Result row must be an object' }
  }

  // Bib is required
  if (row.Bib === undefined || row.Bib === null || row.Bib === '') {
    return { valid: false, error: 'Result row must have a Bib' }
  }

  return { valid: true }
}

/**
 * Validates competitor data from 'comp' or 'oncourse' message
 */
export function validateCompetitorData(data: unknown): ValidationResult {
  if (!isObject(data)) {
    return { valid: false, error: 'Competitor data must be an object' }
  }

  // Empty competitor (Bib empty or missing) is valid - means no one on course
  // So we only validate structure, not content

  return { valid: true }
}
