import { describe, it, expect } from 'vitest'
import {
  isBR2Race,
  isBR1Race,
  isBestRunRace,
  getClassId,
  getRunNumber,
  getOtherRunRaceId,
} from '../raceUtils'

describe('raceUtils', () => {
  describe('isBR2Race', () => {
    it.each([
      ['K1M_ST_BR2_6', true],
      ['C1W_LT_BR2_1', true],
      ['K1M_ST_BR2_99', true],
    ])('returns true for BR2 race "%s"', (raceId, expected) => {
      expect(isBR2Race(raceId)).toBe(expected)
    })

    it.each([
      ['K1M_ST_BR1_6', false],
      ['C1W_LT_XF_1', false],
      ['K1M_ST_QF_3', false],
      ['', false],
      ['BR2', false], // no underscores
    ])('returns false for non-BR2 race "%s"', (raceId, expected) => {
      expect(isBR2Race(raceId)).toBe(expected)
    })
  })

  describe('isBR1Race', () => {
    it.each([
      ['K1M_ST_BR1_6', true],
      ['C1W_LT_BR1_1', true],
      ['K1M_ST_BR1_99', true],
    ])('returns true for BR1 race "%s"', (raceId, expected) => {
      expect(isBR1Race(raceId)).toBe(expected)
    })

    it.each([
      ['K1M_ST_BR2_6', false],
      ['C1W_LT_XF_1', false],
      ['K1M_ST_QF_3', false],
      ['', false],
      ['BR1', false], // no underscores
    ])('returns false for non-BR1 race "%s"', (raceId, expected) => {
      expect(isBR1Race(raceId)).toBe(expected)
    })
  })

  describe('isBestRunRace', () => {
    it.each([
      ['K1M_ST_BR1_6', true],
      ['K1M_ST_BR2_6', true],
      ['C1W_LT_BR1_1', true],
      ['C1W_LT_BR2_1', true],
    ])('returns true for Best Run race "%s"', (raceId, expected) => {
      expect(isBestRunRace(raceId)).toBe(expected)
    })

    it.each([
      ['K1M_ST_XF_6', false],
      ['C1W_LT_QF_1', false],
      ['', false],
    ])('returns false for non-Best Run race "%s"', (raceId, expected) => {
      expect(isBestRunRace(raceId)).toBe(expected)
    })
  })

  describe('getClassId', () => {
    it.each([
      ['K1M_ST_BR1_6', 'K1M_ST'],
      ['K1M_ST_BR2_6', 'K1M_ST'],
      ['C2M_LT_BR1_3', 'C2M_LT'],
      ['C1W_ST_BR2_1', 'C1W_ST'],
      ['K1M_LONG_TRACK_BR1_6', 'K1M_LONG_TRACK'],
    ])('extracts classId "%s" -> "%s"', (raceId, expected) => {
      expect(getClassId(raceId)).toBe(expected)
    })

    it.each([
      ['K1M_ST_XF_6', 'K1M_ST_XF_6'],
      ['InvalidId', 'InvalidId'],
      ['', ''],
    ])('returns original for non-BR race "%s" -> "%s"', (raceId, expected) => {
      expect(getClassId(raceId)).toBe(expected)
    })
  })

  describe('getRunNumber', () => {
    it.each([
      ['K1M_ST_BR1_6', 1],
      ['C1W_LT_BR1_1', 1],
    ])('returns 1 for BR1 race "%s"', (raceId, expected) => {
      expect(getRunNumber(raceId)).toBe(expected)
    })

    it.each([
      ['K1M_ST_BR2_6', 2],
      ['C1W_LT_BR2_1', 2],
    ])('returns 2 for BR2 race "%s"', (raceId, expected) => {
      expect(getRunNumber(raceId)).toBe(expected)
    })

    it.each([
      ['K1M_ST_XF_6', null],
      ['', null],
      ['InvalidId', null],
    ])('returns null for non-BR race "%s"', (raceId, expected) => {
      expect(getRunNumber(raceId)).toBe(expected)
    })
  })

  describe('getOtherRunRaceId', () => {
    it.each([
      ['K1M_ST_BR1_6', 'K1M_ST_BR2_6'],
      ['C2M_LT_BR1_3', 'C2M_LT_BR2_3'],
    ])('converts BR1 to BR2: "%s" -> "%s"', (raceId, expected) => {
      expect(getOtherRunRaceId(raceId)).toBe(expected)
    })

    it.each([
      ['K1M_ST_BR2_6', 'K1M_ST_BR1_6'],
      ['C2M_LT_BR2_3', 'C2M_LT_BR1_3'],
    ])('converts BR2 to BR1: "%s" -> "%s"', (raceId, expected) => {
      expect(getOtherRunRaceId(raceId)).toBe(expected)
    })

    it.each([
      ['K1M_ST_XF_6', null],
      ['', null],
      ['InvalidId', null],
    ])('returns null for non-BR race "%s"', (raceId, expected) => {
      expect(getOtherRunRaceId(raceId)).toBe(expected)
    })
  })
})
