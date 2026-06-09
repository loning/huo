import { describe, expect, it } from 'vitest'
import * as bitcoin from 'bitcoinjs-lib'
import { mnemonicToAccount } from '../src/lib/keys.js'
import { buildAndSignTx } from '../src/lib/tx.js'

const FIXED_MNEMONIC =
  'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about'
const RECIPIENT_ADDRESS = 'tb1qd7spv5q28348xl4myc8zmh983w5jx32cjhkn97'

const UTXOS = [
  {
    txid: '11'.repeat(32),
    vout: 0,
    value: 70_000,
  },
  {
    txid: '22'.repeat(32),
    vout: 1,
    value: 90_000,
  },
  {
    txid: '33'.repeat(32),
    vout: 2,
    value: 120_000,
  },
]

function parseTx(result) {
  return bitcoin.Transaction.fromHex(result.rawTxHex)
}

function outputValue(tx, index) {
  return tx.outs[index].value
}

function outputAddress(tx, index) {
  return bitcoin.address.fromOutputScript(
    tx.outs[index].script,
    bitcoin.networks.testnet,
  )
}

describe('testnet transaction builder', () => {
  it('builds and signs a deterministic P2WPKH transaction', () => {
    const result = buildAndSignTx({
      mnemonic: FIXED_MNEMONIC,
      toAddress: RECIPIENT_ADDRESS,
      amountSats: 50_000,
      utxos: UTXOS,
      feeRate: 2,
    })
    const tx = parseTx(result)

    expect(result).toEqual({
      rawTxHex: '0200000000010111111111111111111111111111111111111111111111111111111111111111110000000000ffffffff0250c30000000000001600146fa016500a3c6a737ebb260e2ddca78ba9234558084d000000000000160014d0c4a3ef09e997b6e99e397e518fe3e41a118ca102483045022100fa5521583a112d81ddf1ce71f0eace7a05defb84ade23ac68448de404ab2f29b022076a36af3b5bdb3dd85b4e96b4cd7572e5d7097d0334917fa89b76438d78ec1fd012102e7ab2537b5d49e970309aae06e9e49f36ce1c9febbd44ec8e0d1cca0b4f9c31900000000',
      txid: '361b0af96a77ee21a912647afeb619c21788ca5c3767993ae7e12e170f51bf1d',
      feeSats: 280,
    })
    expect(tx.getId()).toBe(result.txid)
    expect(tx.ins).toHaveLength(1)
    expect(tx.outs).toHaveLength(2)
    expect(outputAddress(tx, 0)).toBe(RECIPIENT_ADDRESS)
    expect(outputValue(tx, 0)).toBe(50_000)
    expect(outputAddress(tx, 1)).toBe(mnemonicToAccount(FIXED_MNEMONIC).address)
    expect(outputValue(tx, 1)).toBe(19_720)
  })

  it('selects inputs in caller-provided order until the spend is funded', () => {
    const result = buildAndSignTx({
      mnemonic: FIXED_MNEMONIC,
      toAddress: RECIPIENT_ADDRESS,
      amountSats: 145_000,
      utxos: UTXOS,
      feeRate: 1,
    })
    const tx = parseTx(result)

    expect(tx.ins).toHaveLength(2)
    expect(Buffer.from(tx.ins[0].hash).reverse().toString('hex')).toBe(
      UTXOS[0].txid,
    )
    expect(Buffer.from(tx.ins[1].hash).reverse().toString('hex')).toBe(
      UTXOS[1].txid,
    )
    expect(outputValue(tx, 0)).toBe(145_000)
    expect(outputAddress(tx, 1)).toBe(mnemonicToAccount(FIXED_MNEMONIC).address)
    expect(outputValue(tx, 1)).toBe(14_792)
    expect(result.feeSats).toBe(208)
  })

  it('raises fee when feeRate increases', () => {
    const lowFee = buildAndSignTx({
      mnemonic: FIXED_MNEMONIC,
      toAddress: RECIPIENT_ADDRESS,
      amountSats: 50_000,
      utxos: UTXOS,
      feeRate: 1,
    })
    const highFee = buildAndSignTx({
      mnemonic: FIXED_MNEMONIC,
      toAddress: RECIPIENT_ADDRESS,
      amountSats: 50_000,
      utxos: UTXOS,
      feeRate: 5,
    })

    expect(highFee.feeSats).toBeGreaterThan(lowFee.feeSats)
    expect(outputValue(parseTx(highFee), 1)).toBeLessThan(
      outputValue(parseTx(lowFee), 1),
    )
  })

  it('folds dust-sized change into the transaction fee', () => {
    const result = buildAndSignTx({
      mnemonic: FIXED_MNEMONIC,
      toAddress: RECIPIENT_ADDRESS,
      amountSats: 69_750,
      utxos: UTXOS,
      feeRate: 1,
    })
    const tx = parseTx(result)

    expect(tx.ins).toHaveLength(1)
    expect(tx.outs).toHaveLength(1)
    expect(outputAddress(tx, 0)).toBe(RECIPIENT_ADDRESS)
    expect(outputValue(tx, 0)).toBe(69_750)
    expect(result.feeSats).toBe(250)
  })

  it('rejects insufficient funds without exposing wallet secrets', () => {
    expect(() =>
      buildAndSignTx({
        mnemonic: FIXED_MNEMONIC,
        toAddress: RECIPIENT_ADDRESS,
        amountSats: 500_000,
        utxos: UTXOS,
        feeRate: 1,
      }),
    ).toThrow('Insufficient funds')
  })

  it('does not leak mnemonic, WIF, or private-key material in errors and results', () => {
    const account = mnemonicToAccount(FIXED_MNEMONIC)
    const result = buildAndSignTx({
      mnemonic: FIXED_MNEMONIC,
      toAddress: RECIPIENT_ADDRESS,
      amountSats: 50_000,
      utxos: UTXOS,
      feeRate: 1,
    })
    const serializedResult = JSON.stringify(result)

    expect(serializedResult).not.toContain(FIXED_MNEMONIC)
    expect(serializedResult).not.toContain(account.wif)

    try {
      buildAndSignTx({
        mnemonic: FIXED_MNEMONIC,
        toAddress: RECIPIENT_ADDRESS,
        amountSats: 500_000,
        utxos: UTXOS,
        feeRate: 1,
      })
    } catch (error) {
      expect(error.message).not.toContain(FIXED_MNEMONIC)
      expect(error.message).not.toContain(account.wif)
      expect(error.message.toLowerCase()).not.toContain('private')
    }
  })
})
