/**
 * Labels from tokens, by lookup in the display policy (CLIENT-OBLIGATIONS L45, L144, L158): no natural-language
 * text comes on the wire, and no id is parsed for a run (L27).
 */
import type { Phase } from '@opencanoetiming/c123-contract'
import type { DisplayPolicy, NoResultStatus } from './displayPolicy'

/**
 * The run label of the title (#170, choice 5): the organiser's race title when set; else the label of the
 * `format` token; else of the pair role; else the token verbatim.
 */
export function runLabel(phase: Phase, policy: DisplayPolicy): string {
  if (phase.title?.state === 'known' && phase.title.value) return phase.title.value
  const byFormat = policy.runLabel[phase.format]
  if (byFormat !== undefined) return byFormat
  if (phase.pair) return policy.pairRunLabel[phase.pair.role]
  return phase.format
}

/** The mark of a no-result outcome (#170, choice 4). */
export function noResultLabel(status: NoResultStatus, policy: DisplayPolicy): string {
  return policy.noResultMark[status] ?? status
}
