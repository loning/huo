import { describe, it, expect } from 'vitest'
import {
  clearWallet,
  decryptMnemonic,
  encryptMnemonic,
  loadWallet,
  saveWallet,
} from '../src/lib/storage.js'

function createStorage() {
  const values = new Map()

  return {
    getItem(key) {
      return values.has(key) ? values.get(key) : null
    },
    setItem(key, value) {
      values.set(key, String(value))
    },
    removeItem(key) {
      values.delete(key)
    },
  }
}

describe('encrypted wallet storage', () => {
  const mnemonic = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about'
  const password = 'testnet teaching wallet passphrase'

  it('encrypts mnemonics into a versioned AES-GCM envelope', async () => {
    const envelope = await encryptMnemonic(mnemonic, password)

    expect(envelope).toEqual({
      version: 1,
      kdf: 'PBKDF2',
      hash: 'SHA-256',
      iterations: 600000,
      salt: expect.any(String),
      cipher: 'AES-GCM',
      iv: expect.any(String),
      ciphertext: expect.any(String),
    })
    expect(envelope.salt).not.toBe('')
    expect(envelope.iv).not.toBe('')
    expect(envelope.ciphertext).not.toContain(mnemonic)
  })

  it('decrypts an encrypted mnemonic with the matching password', async () => {
    const envelope = await encryptMnemonic(mnemonic, password)

    await expect(decryptMnemonic(envelope, password)).resolves.toBe(mnemonic)
  })

  it('rejects decrypting with the wrong password', async () => {
    const envelope = await encryptMnemonic(mnemonic, password)

    await expect(decryptMnemonic(envelope, 'wrong password')).rejects.toThrow()
  })

  it('saves and loads encrypted wallets through injected storage', async () => {
    const storage = createStorage()

    const envelope = await saveWallet(mnemonic, password, storage)
    const storedWallet = storage.getItem('huo.wallet.v1')

    expect(storedWallet).not.toContain(mnemonic)
    expect(JSON.parse(storedWallet)).toEqual(envelope)
    await expect(loadWallet(password, storage)).resolves.toBe(mnemonic)
  })

  it('returns null when no wallet is saved', async () => {
    await expect(loadWallet(password, createStorage())).resolves.toBeNull()
  })

  it('rejects malformed stored wallet data', async () => {
    const storage = createStorage()
    storage.setItem('huo.wallet.v1', JSON.stringify({ version: 1 }))

    await expect(loadWallet(password, storage)).rejects.toThrow('Invalid wallet envelope')
  })

  it('clears the saved wallet from injected storage', async () => {
    const storage = createStorage()
    await saveWallet(mnemonic, password, storage)

    clearWallet(storage)

    expect(storage.getItem('huo.wallet.v1')).toBeNull()
  })
})
