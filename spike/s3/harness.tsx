/**
 * Mounts today's scoreboard on a FixtureReplayProvider (TEST-ARCHITECTURE §3.3 steps 1-3)
 * and exposes the view-model and the DOM for assertions (step 4).
 */

import { useEffect } from 'react'
import { act, render } from '@testing-library/react'
import { ScoreboardProvider, useScoreboard, type ScoreboardContextValue } from '@/context/ScoreboardContext'
import { useHighlight, type UseHighlightReturn } from '@/hooks/useHighlight'
import { CurrentCompetitor } from '@/components/CurrentCompetitor'
import { ResultsList } from '@/components/ResultsList'
import { FixtureReplayProvider, type Fixture } from './FixtureReplayProvider'
import { installFakeClock, uninstallFakeClock } from './fakeClock'

/**
 * The results and current-competitor part of App.tsx's ScoreboardContent (App.tsx:75-150),
 * which is not exported. Kept to the components that consume on-course and results state.
 */
function ScoreboardContentReplica() {
  const { currentCompetitor, departingCompetitor, results, visibility } = useScoreboard()
  const finishingDeparture = departingCompetitor?.dtFinish ? departingCompetitor : null
  const displayCompetitor = finishingDeparture ?? currentCompetitor ?? departingCompetitor
  const isDeparting = !!finishingDeparture || (!currentCompetitor && !!departingCompetitor)
  return (
    <>
      <CurrentCompetitor competitor={displayCompetitor} visible={visibility.displayCurrent} isDeparting={isDeparting} />
      <ResultsList results={results} visible={visibility.displayTop} />
    </>
  )
}

export interface MountedScoreboard {
  provider: FixtureReplayProvider
  container: HTMLElement
  view(): ScoreboardContextValue
  highlight(): UseHighlightReturn
  onCourseBibs(): string[]
  resultBibs(): string[]
  /** Deliver every step up to and including `index`, each in its own act() so effects flush per step */
  replayThrough(index: number): Promise<void>
  /** Advance the clock with no fixture entry */
  advanceTo(epochMs: number): Promise<void>
  unmount(): void
}

export function mountScoreboard(fixture: Fixture): MountedScoreboard {
  // §3.3 step 2: the clock starts at the first step's observedAt
  const clock = installFakeClock(Date.parse(fixture.steps[0].ws.timestamp))
  const provider = new FixtureReplayProvider(fixture, clock)

  // The view-model a render function consumes, captured after every commit
  const latest: { view?: ScoreboardContextValue; highlight?: UseHighlightReturn } = {}
  function Probe() {
    const view = useScoreboard()
    const highlight = useHighlight()
    useEffect(() => {
      latest.view = view
      latest.highlight = highlight
    })
    return null
  }

  const utils = render(
    <ScoreboardProvider provider={provider}>
      <ScoreboardContentReplica />
      <Probe />
    </ScoreboardProvider>
  )

  return {
    provider,
    container: utils.container,
    view: () => latest.view!,
    highlight: () => latest.highlight!,
    onCourseBibs: () => latest.view!.onCourse.map((c) => c.bib),
    resultBibs: () =>
      Array.from(utils.container.querySelectorAll<HTMLElement>('[data-testid="results-list"] [data-bib]')).map(
        (row) => row.dataset.bib!
      ),
    // Async act() so microtask-scheduled updates (useAutoScroll's queueMicrotask) land inside it
    async replayThrough(index: number) {
      while (provider.position <= index) {
        await act(async () => provider.step())
      }
    },
    async advanceTo(epochMs: number) {
      await act(async () => provider.advanceTo(epochMs))
    },
    unmount() {
      utils.unmount()
      uninstallFakeClock()
    },
  }
}
