import { describe, it, expect } from 'vitest'
import { config, getAgeGroupConfig } from '@/config'

describe('config', () => {
  it('has valid age group labels', () => {
    expect(config.ageGroups.young.label).toBe('4-6')
    expect(config.ageGroups.older.label).toBe('7-10')
  })

  it('getAgeGroupConfig returns young for 4-6', () => {
    expect(getAgeGroupConfig('4-6')).toEqual(config.ageGroups.young)
  })

  it('getAgeGroupConfig returns older for 7-10', () => {
    expect(getAgeGroupConfig('7-10')).toEqual(config.ageGroups.older)
  })

  it('getAgeGroupConfig defaults to young for unknown input', () => {
    expect(getAgeGroupConfig('unknown' as any)).toEqual(config.ageGroups.young)
  })
})
