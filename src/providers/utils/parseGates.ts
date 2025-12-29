/**
 * Gate penalty values
 */
export type GatePenalty = 0 | 2 | 50 | null

/**
 * Parse gates string into array of penalties
 *
 * Input formats:
 * - Comma-separated: "0,0,2,0,50,0"
 * - Space-separated: "0 0 2 0 50 0"
 * - Mixed: "0,0 2,0 50,0"
 *
 * Output:
 * - Array of penalties: [0, 0, 2, 0, 50, 0]
 * - Empty string between separators: null (not yet passed)
 *
 * @param gates - Gates string from competitor data
 * @returns Array of gate penalties
 */
export function parseGates(gates: string | null | undefined): GatePenalty[] {
  // Handle non-string inputs gracefully
  if (gates === null || gates === undefined) {
    return []
  }

  if (typeof gates !== 'string') {
    return []
  }

  if (gates.trim() === '') {
    return []
  }

  // Split by comma or space, filter out empty strings from consecutive separators
  const parts = gates.split(/[,\s]+/).filter((part) => part !== '')

  return parts.map((part) => {
    const value = parseInt(part, 10)

    if (isNaN(value)) {
      return null
    }

    // Only valid penalty values are 0, 2, 50
    if (value === 0 || value === 2 || value === 50) {
      return value
    }

    // Invalid value - treat as null
    return null
  })
}

/**
 * Calculate total penalty from gates array
 *
 * @param gates - Array of gate penalties
 * @returns Total penalty in seconds
 */
export function calculateTotalPenalty(gates: GatePenalty[]): number {
  return gates.reduce<number>((sum, pen) => sum + (pen ?? 0), 0)
}
