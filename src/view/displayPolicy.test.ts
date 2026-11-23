import { describe, expect, it } from 'vitest'
import { classifyPenalty } from './displayPolicy'

// One home for the penalty colour, shared by the selector and the legacy adapter (review of #177):
// 0 clear, up to two touches (4 s) a touch, anything more a miss; three digits from 100 s.

describe('classifyPenalty', () => {
  it.each([
    [0, 'clear', false],
    [2, 'touch', false],
    [4, 'touch', false],
    [50, 'miss', false],
    [52, 'miss', false],
    [100, 'miss', true],
    [152, 'miss', true],
  ] as const)('%i s -> %s, large %s', (seconds, kind, large) => {
    expect(classifyPenalty(seconds)).toEqual({ penaltyKind: kind, penaltyLarge: large })
  })
})
