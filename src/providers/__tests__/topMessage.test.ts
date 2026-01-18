import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ReplayProvider } from '../ReplayProvider'

const jsonlWithTop = `{"_meta":{"version":2}}
{"ts":4,"src":"ws","type":"title","data":{"msg":"title","data":{"text":"Test Race"}}}
{"ts":100,"src":"ws","type":"top","data":{"msg":"top","data":{"RaceName":"K1m Test","RaceStatus":"In Progress","HighlightBib":0,"list":[{"Rank":"1","Bib":"1","Name":"Test Athlete","Total":"78.99","Pen":"2","Behind":""}]}}}
`

describe('Top message handling', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('should emit results from top message', async () => {
    const provider = new ReplayProvider(jsonlWithTop, { autoPlay: false, speed: 1000 })
    const resultsCallback = vi.fn()
    provider.onResults(resultsCallback)

    await provider.connect()

    expect(provider.messageCount).toBe(2) // title + top

    provider.play()

    // Advance time to dispatch all messages
    await vi.advanceTimersByTimeAsync(200)

    expect(resultsCallback).toHaveBeenCalled()

    const [data] = resultsCallback.mock.calls[0]
    expect(data.raceName).toBe('K1m Test')
    expect(data.results.length).toBe(1)
    expect(data.results[0].bib).toBe('1')
    expect(data.results[0].name).toBe('Test Athlete')
    expect(data.results[0].total).toBe('78.99')
    expect(data.results[0].pen).toBe(2)
  })

  it('should emit multiple results', async () => {
    const jsonlMultiple = `{"_meta":{"version":2}}
{"ts":100,"src":"ws","type":"top","data":{"msg":"top","data":{"RaceName":"K1m Test","RaceStatus":"In Progress","list":[{"Rank":"1","Bib":"1","Name":"Athlete One","Total":"78.99","Pen":"2","Behind":""},{"Rank":"2","Bib":"2","Name":"Athlete Two","Total":"80.00","Pen":"0","Behind":"+1.01"}]}}}
`
    const provider = new ReplayProvider(jsonlMultiple, { autoPlay: false, speed: 1000 })
    const resultsCallback = vi.fn()
    provider.onResults(resultsCallback)

    await provider.connect()
    provider.play()

    await vi.advanceTimersByTimeAsync(200)

    expect(resultsCallback).toHaveBeenCalled()

    const [data] = resultsCallback.mock.calls[0]
    expect(data.results.length).toBe(2)
    expect(data.results[0].bib).toBe('1')
    expect(data.results[1].bib).toBe('2')
  })
})
