import * as bip39 from 'bip39'
import * as bitcoin from 'bitcoinjs-lib'
import { BIP32Factory } from 'bip32'
import ecc from '@bitcoinerlab/secp256k1'

const bip32 = BIP32Factory(ecc)
const NETWORK = bitcoin.networks.testnet
const ACCOUNT_PATH_PREFIX = "m/84'/1'/0'/0"

export function generateMnemonic() {
  return bip39.generateMnemonic(128)
}

export function validateMnemonic(mnemonic) {
  return bip39.validateMnemonic(mnemonic)
}

export function mnemonicToAccount(mnemonic, index = 0) {
  if (!validateMnemonic(mnemonic)) {
    throw new Error('Invalid mnemonic')
  }

  if (!Number.isInteger(index) || index < 0) {
    throw new RangeError('Account index must be a non-negative integer')
  }

  const path = `${ACCOUNT_PATH_PREFIX}/${index}`
  const seed = bip39.mnemonicToSeedSync(mnemonic)
  const root = bip32.fromSeed(seed, NETWORK)
  const child = root.derivePath(path)
  const payment = bitcoin.payments.p2wpkh({
    pubkey: child.publicKey,
    network: NETWORK,
  })

  if (!payment.address) {
    throw new Error('Unable to derive account address')
  }

  return {
    address: payment.address,
    wif: child.toWIF(),
    path,
  }
}
