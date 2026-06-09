import * as bitcoin from 'bitcoinjs-lib'
import ecc from '@bitcoinerlab/secp256k1'
import { ECPairFactory } from 'ecpair'
import { mnemonicToAccount } from './keys.js'

bitcoin.initEccLib(ecc)

const ECPair = ECPairFactory(ecc)
const NETWORK = bitcoin.networks.testnet
const P2WPKH_INPUT_VSIZE = 68
const P2WPKH_OUTPUT_VSIZE = 31
const TX_OVERHEAD_VSIZE = 10
const DUST_THRESHOLD_SATS = 546

function assertPositiveInteger(value, name) {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new RangeError(`${name} must be a positive integer`)
  }
}

function assertNonNegativeInteger(value, name) {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new RangeError(`${name} must be a non-negative integer`)
  }
}

function validateFeeRate(feeRate) {
  if (!Number.isFinite(feeRate) || feeRate <= 0) {
    throw new RangeError('feeRate must be a positive number')
  }
}

function validateRecipientAddress(address) {
  try {
    bitcoin.address.toOutputScript(address, NETWORK)
  } catch {
    throw new Error('Recipient address must be a valid testnet address')
  }
}

function normalizeUtxos(utxos) {
  if (!Array.isArray(utxos)) {
    throw new TypeError('utxos must be an array')
  }

  return utxos.map((utxo, index) => {
    if (!utxo || typeof utxo !== 'object') {
      throw new TypeError(`utxos[${index}] must be an object`)
    }

    if (typeof utxo.txid !== 'string' || !/^[0-9a-fA-F]{64}$/.test(utxo.txid)) {
      throw new Error(`utxos[${index}].txid must be a 64-character hex string`)
    }

    assertNonNegativeInteger(utxo.vout, `utxos[${index}].vout`)
    assertPositiveInteger(utxo.value, `utxos[${index}].value`)

    return {
      txid: utxo.txid.toLowerCase(),
      vout: utxo.vout,
      value: utxo.value,
    }
  })
}

function estimateP2wpkhFee(inputCount, outputCount, feeRate) {
  const vsize =
    TX_OVERHEAD_VSIZE +
    inputCount * P2WPKH_INPUT_VSIZE +
    outputCount * P2WPKH_OUTPUT_VSIZE

  return Math.ceil(vsize * feeRate)
}

function selectUtxos(utxos, amountSats, feeRate) {
  const selected = []
  let totalInputSats = 0

  for (const utxo of utxos) {
    selected.push(utxo)
    totalInputSats += utxo.value

    const feeWithChange = estimateP2wpkhFee(selected.length, 2, feeRate)
    const changeSats = totalInputSats - amountSats - feeWithChange

    if (changeSats >= DUST_THRESHOLD_SATS) {
      return { selected, feeSats: feeWithChange, changeSats }
    }

    const feeWithoutChange = estimateP2wpkhFee(selected.length, 1, feeRate)
    const remainderSats = totalInputSats - amountSats - feeWithoutChange

    if (remainderSats >= 0) {
      return {
        selected,
        feeSats: totalInputSats - amountSats,
        changeSats: 0,
      }
    }
  }

  throw new Error('Insufficient funds')
}

export function buildAndSignTx({
  mnemonic,
  accountIndex = 0,
  toAddress,
  amountSats,
  utxos,
  feeRate,
}) {
  assertPositiveInteger(amountSats, 'amountSats')
  validateFeeRate(feeRate)
  validateRecipientAddress(toAddress)

  const normalizedUtxos = normalizeUtxos(utxos)
  const account = mnemonicToAccount(mnemonic, accountIndex)
  const keyPair = ECPair.fromWIF(account.wif, NETWORK)
  const sourceScript = bitcoin.address.toOutputScript(account.address, NETWORK)
  const { selected, feeSats, changeSats } = selectUtxos(
    normalizedUtxos,
    amountSats,
    feeRate,
  )

  const psbt = new bitcoin.Psbt({ network: NETWORK })

  for (const utxo of selected) {
    psbt.addInput({
      hash: utxo.txid,
      index: utxo.vout,
      witnessUtxo: {
        script: sourceScript,
        value: utxo.value,
      },
    })
  }

  psbt.addOutput({
    address: toAddress,
    value: amountSats,
  })

  if (changeSats >= DUST_THRESHOLD_SATS) {
    psbt.addOutput({
      address: account.address,
      value: changeSats,
    })
  }

  for (let index = 0; index < selected.length; index += 1) {
    psbt.signInput(index, keyPair)
  }

  psbt.finalizeAllInputs()

  const tx = psbt.extractTransaction()

  return {
    rawTxHex: tx.toHex(),
    txid: tx.getId(),
    feeSats,
  }
}
