/**
 * Labels from tokens, by lookup in the display policy (CLIENT-OBLIGATIONS L45, L144, L158): no natural-language
 * text comes on the wire, and no id is parsed for a run (L27).
 */
import type { Phase } from '@opencanoetiming/c123-contract'
import type { DisplayPolicy, NoResultStatus } from './displayPolicy'

/**
 * The run label of the title (#170, choice 5): the label of the `format` token, else the token verbatim,
 * paired or not (DERIVATIONS §9, CONTRACTS §2.4). The organiser's `title` is not the on-site run label.
 */
export function runLabel(phase: Phase, policy: DisplayPolicy): string {
  return policy.runLabel[phase.format] ?? phase.format
}

/** The mark of a no-result outcome (#170, choice 4). */
export function noResultLabel(status: NoResultStatus, policy: DisplayPolicy): string {
  return policy.noResultMark[status] ?? status
}
