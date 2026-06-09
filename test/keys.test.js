import { describe, expect, it } from 'vitest'
import {
  generateMnemonic,
  mnemonicToAccount,
  validateMnemonic,
} from '../src/lib/keys.js'

const FIXED_MNEMONIC =
  'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about'

describe('keys', () => {
  it('generates a valid 12-word mnemonic', () => {
    const mnemonic = generateMnemonic()

    expect(mnemonic.split(' ')).toHaveLength(12)
    expect(validateMnemonic(mnemonic)).toBe(true)
  })

  it('validates mnemonics defensively', () => {
    expect(validateMnemonic(FIXED_MNEMONIC)).toBe(true)
    expect(validateMnemonic('not a valid mnemonic')).toBe(false)
  })

  it('derives the first BIP84 testnet P2WPKH account', () => {
    expect(mnemonicToAccount(FIXED_MNEMONIC)).toEqual({
      address: 'tb1q6rz28mcfaxtmd6v789l9rrlrusdprr9pqcpvkl',
      wif: 'cTGhosGriPpuGA586jemcuH9pE9spwUmneMBmYYzrQEbY92DJrbo',
      path: "m/84'/1'/0'/0/0",
    })
  })

  it('derives stable, distinct accounts by index', () => {
    const first = mnemonicToAccount(FIXED_MNEMONIC, 0)
    const firstAgain = mnemonicToAccount(FIXED_MNEMONIC, 0)
    const second = mnemonicToAccount(FIXED_MNEMONIC, 1)

    expect(firstAgain).toEqual(first)
    expect(second).toEqual({
      address: 'tb1qd7spv5q28348xl4myc8zmh983w5jx32cjhkn97',
      wif: 'cQFUndrpAyMaE3HAsjMCXiT94MzfsABCREat1x7Qe3Mtq9KihD4V',
      path: "m/84'/1'/0'/0/1",
    })
    expect(second.address).not.toBe(first.address)
  })

  it('rejects invalid mnemonic and index inputs', () => {
    expect(() => mnemonicToAccount('not a valid mnemonic')).toThrow(
      'Invalid mnemonic',
    )
    expect(() => mnemonicToAccount(FIXED_MNEMONIC, -1)).toThrow(
      'Account index must be a non-negative integer',
    )
    expect(() => mnemonicToAccount(FIXED_MNEMONIC, 1.5)).toThrow(
      'Account index must be a non-negative integer',
    )
  })
})
