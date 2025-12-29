/**
 * UI element visibility state
 */
export interface VisibilityState {
  displayCurrent: boolean
  displayTop: boolean
  displayTitle: boolean
  displayTopBar: boolean
  displayFooter: boolean
  displayDayTime: boolean
  displayOnCourse: boolean
}

/**
 * Default visibility - all visible
 */
export const defaultVisibility: VisibilityState = {
  displayCurrent: true,
  displayTop: true,
  displayTitle: true,
  displayTopBar: true,
  displayFooter: true,
  displayDayTime: false, // disabled by default, kept for future use
  displayOnCourse: true,
}
