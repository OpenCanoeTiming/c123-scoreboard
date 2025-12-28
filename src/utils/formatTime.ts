/**
 * Formats a time value for display in the scoreboard.
 *
 * Input formats:
 * - Seconds with decimals: "78.99", "147.91", "1:23.45"
 * - Empty/null: "", null, undefined
 * - Already formatted: "1:23.45"
 *
 * Output format: "1:23.45" or "23.45" (for under 1 minute)
 */
export function formatTime(
  value: string | number | null | undefined
): string {
  if (value === null || value === undefined || value === '') {
    return ''
  }

  // Convert to string if number
  const str = typeof value === 'number' ? value.toString() : value.trim()

  if (str === '') {
    return ''
  }

  // If already contains colon, it's already formatted
  if (str.includes(':')) {
    return str
  }

  // Parse as seconds
  const seconds = parseFloat(str)

  if (isNaN(seconds)) {
    return str // Return original if not a valid number
  }

  if (seconds < 0) {
    // Handle negative times (shouldn't happen, but be safe)
    return str
  }

  // Extract minutes and remaining seconds
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = seconds % 60

  // Format remaining seconds with 2 decimal places
  const formattedSeconds = remainingSeconds.toFixed(2)

  if (minutes === 0) {
    return formattedSeconds
  }

  // Pad seconds part to ensure format like "1:03.45" not "1:3.45"
  const paddedSeconds =
    remainingSeconds < 10 ? `0${formattedSeconds}` : formattedSeconds

  return `${minutes}:${paddedSeconds}`
}

/**
 * Formats a time difference (behind time) for display.
 *
 * Input formats:
 * - Positive difference: "+5.34", "+272.19"
 * - No difference (first place): "&nbsp;", "", null
 * - Already formatted: "+1:23.45"
 *
 * Output format: "+1:23.45" or "+23.45" or "" (for first place)
 */
export function formatBehind(
  value: string | null | undefined
): string {
  if (value === null || value === undefined || value === '') {
    return ''
  }

  const str = value.trim()

  // Handle HTML entities for no difference (first place)
  if (str === '&nbsp;' || str === '\u00A0') {
    return ''
  }

  // Already contains colon, assume formatted
  if (str.includes(':')) {
    return str
  }

  // Check if has sign prefix
  const hasPlus = str.startsWith('+')
  const hasMinus = str.startsWith('-')
  const sign = hasPlus ? '+' : hasMinus ? '-' : '+'

  // Remove sign for parsing
  const numericPart = hasPlus || hasMinus ? str.slice(1) : str
  const seconds = parseFloat(numericPart)

  if (isNaN(seconds)) {
    return str // Return original if not a valid number
  }

  // Format the time part
  const formattedTime = formatTime(seconds)

  if (formattedTime === '') {
    return ''
  }

  return `${sign}${formattedTime}`
}

/**
 * Formats a TTB (Time To Beat) difference for display.
 * Similar to behind, but can be negative (faster than leader).
 *
 * Input: "+1.23", "-0.45", ""
 * Output: "+1.23", "-0.45", ""
 */
export function formatTTBDiff(
  value: string | null | undefined
): string {
  if (value === null || value === undefined || value === '') {
    return ''
  }

  const str = value.trim()

  if (str === '') {
    return ''
  }

  // Already contains colon, assume formatted
  if (str.includes(':')) {
    return str
  }

  // Check sign
  const hasPlus = str.startsWith('+')
  const hasMinus = str.startsWith('-')

  if (!hasPlus && !hasMinus) {
    // No sign - treat as positive
    const seconds = parseFloat(str)
    if (isNaN(seconds)) {
      return str
    }
    return `+${formatTime(seconds)}`
  }

  const sign = hasPlus ? '+' : '-'
  const numericPart = str.slice(1)
  const seconds = parseFloat(numericPart)

  if (isNaN(seconds)) {
    return str
  }

  const formattedTime = formatTime(seconds)
  if (formattedTime === '') {
    return ''
  }

  return `${sign}${formattedTime}`
}
