/**
 * Utility for classifying gate penalties
 *
 * Used by CurrentCompetitor and OnCourseDisplay components to style gate badges.
 */

import type { GatePenalty } from '@/providers/utils/parseGates'

/**
 * Classification of gate penalty for styling
 */
export type GatePenaltyClass = 'none' | 'penalty2' | 'penalty50'

/**
 * Get penalty classification for CSS styling
 *
 * @param penalty - Gate penalty value (0, 2, 50, or null)
 * @returns Classification string for component to map to CSS
 *
 * @example
 * const penaltyClass = getGatePenaltyClass(2)
 * // Returns 'penalty2' - component maps to styles.penalty2
 */
export function getGatePenaltyClass(penalty: GatePenalty): GatePenaltyClass {
  if (penalty === null || penalty === 0) return 'none'
  if (penalty === 2) return 'penalty2'
  return 'penalty50'
}

/**
 * Get CSS class for gate penalty using provided styles object
 *
 * This is a higher-order function that accepts a CSS module styles object
 * and returns a function that maps penalties to CSS classes.
 *
 * @param styles - CSS module styles object with penalty2 and penalty50 classes
 * @returns Function that maps GatePenalty to CSS class string
 *
 * @example
 * import styles from './Component.module.css'
 * const getGateClass = createGateClassGetter(styles)
 * const className = getGateClass(2) // Returns styles.penalty2
 */
export function createGateClassGetter(
  styles: Record<string, string | undefined>
): (penalty: GatePenalty) => string {
  return (penalty: GatePenalty): string => {
    const classification = getGatePenaltyClass(penalty)
    if (classification === 'penalty2') return styles.penalty2 ?? ''
    if (classification === 'penalty50') return styles.penalty50 ?? ''
    return ''
  }
}
