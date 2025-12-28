/**
 * Maximum length for displayed name before truncation.
 * This ensures names fit within the UI layout.
 */
const MAX_NAME_LENGTH = 25

/**
 * Formats a competitor name for display.
 *
 * Input formats from data:
 * - Combined: "KREJČÍ Jakub", "NOVÁK Matyáš"
 * - Separate fields: familyName="KREJČÍ", givenName="Jakub"
 *
 * Output format: "KREJČÍ Jakub" (PŘÍJMENÍ Jméno)
 */
export function formatName(
  name: string | null | undefined,
  familyName?: string | null,
  givenName?: string | null
): string {
  // If we have separate family/given names, use them
  if (familyName && givenName) {
    const combined = `${familyName.trim()} ${givenName.trim()}`
    return truncateName(combined)
  }

  // If we have family name only
  if (familyName && !givenName) {
    return truncateName(familyName.trim())
  }

  // Use the combined name field
  if (!name) {
    return ''
  }

  const trimmed = name.trim()
  if (trimmed === '') {
    return ''
  }

  return truncateName(trimmed)
}

/**
 * Truncates a name if it exceeds MAX_NAME_LENGTH.
 * Tries to truncate at word boundary if possible.
 */
function truncateName(name: string): string {
  if (name.length <= MAX_NAME_LENGTH) {
    return name
  }

  // Try to find a word boundary before max length
  const truncateAt = name.lastIndexOf(' ', MAX_NAME_LENGTH - 1)

  if (truncateAt > MAX_NAME_LENGTH * 0.5) {
    // Found a reasonable word boundary
    return name.slice(0, truncateAt).trim()
  }

  // No good word boundary, just truncate
  return name.slice(0, MAX_NAME_LENGTH - 1).trim() + '…'
}

/**
 * Formats a club name for display.
 * Club names can be long, so we truncate them.
 */
const MAX_CLUB_LENGTH = 30

export function formatClub(club: string | null | undefined): string {
  if (!club) {
    return ''
  }

  const trimmed = club.trim()
  if (trimmed === '') {
    return ''
  }

  if (trimmed.length <= MAX_CLUB_LENGTH) {
    return trimmed
  }

  // Try word boundary
  const truncateAt = trimmed.lastIndexOf(' ', MAX_CLUB_LENGTH - 1)

  if (truncateAt > MAX_CLUB_LENGTH * 0.5) {
    return trimmed.slice(0, truncateAt).trim()
  }

  return trimmed.slice(0, MAX_CLUB_LENGTH - 1).trim() + '…'
}

/**
 * Formats nationality code for display.
 * Usually 3-letter country code like "CZE", "AUT".
 */
export function formatNat(nat: string | null | undefined): string {
  if (!nat) {
    return ''
  }

  return nat.trim().toUpperCase()
}
