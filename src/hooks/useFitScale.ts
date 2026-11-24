import { useEffect, useState, type RefObject } from 'react'
import { useClock } from '@/clock/clockContext'

/** Quiet time after the last resize notification before the content is measured again. */
const MEASURE_DEBOUNCE_MS = 100

/**
 * Scale that makes the element's natural (unscaled) height fill `viewportHeight`.
 *
 * The height is measured (ResizeObserver, debounced on the Clock), never estimated,
 * so the scaled board fits whatever the rows and the on-course block really take.
 * Returns 1 while disabled or before the first measurement.
 */
export function useFitScale(
  ref: RefObject<HTMLElement | null>,
  enabled: boolean,
  viewportHeight: number
): number {
  const clock = useClock()
  const [contentHeight, setContentHeight] = useState(0)

  useEffect(() => {
    const el = ref.current
    if (!enabled || !el) return

    const measure = () => setContentHeight(el.offsetHeight)
    measure()

    let timeoutId: number | null = null
    const observer = new ResizeObserver(() => {
      if (timeoutId !== null) clock.clearTimeout(timeoutId)
      timeoutId = clock.setTimeout(() => {
        timeoutId = null
        measure()
      }, MEASURE_DEBOUNCE_MS)
    })
    observer.observe(el)

    return () => {
      observer.disconnect()
      if (timeoutId !== null) clock.clearTimeout(timeoutId)
    }
  }, [ref, enabled, clock])

  if (!enabled || contentHeight <= 0 || viewportHeight <= 0) return 1
  return viewportHeight / contentHeight
}
