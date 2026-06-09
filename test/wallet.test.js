import { describe, expect, it } from 'vitest'
import { describeNetwork, isSupportedNetwork } from '../src/lib/wallet.js'

describe('wallet network helpers', () => {
  it('labels testnet', () => {
    expect(describeNetwork('testnet')).toBe('Bitcoin Testnet')
  })

  it('labels unknown networks defensively', () => {
    expect(describeNetwork('regtest')).toBe('Unknown Network')
  })

  it('reports supported networks', () => {
    expect(isSupportedNetwork('testnet')).toBe(true)
    expect(isSupportedNetwork('regtest')).toBe(false)
  })
})
