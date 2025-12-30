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

