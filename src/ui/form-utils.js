const TESTNET_EXPLORER_TX_BASE_URL = 'https://mempool.space/testnet/tx'
const TESTNET_ADDRESS_PATTERN = /^(tb1[ac-hj-np-z02-9]{11,87}|[mn2][1-9A-HJ-NP-Za-km-z]{25,40})$/

export function parseSatsInput(value) {
  const normalized = String(value ?? '').trim()

  if (!/^[0-9]+$/.test(normalized)) {
    return { ok: false, error: '请输入正整数聪数' }
  }

  const sats = Number(normalized)

  if (!Number.isSafeInteger(sats) || sats <= 0) {
    return { ok: false, error: '金额必须是安全范围内的正整数聪数' }
  }

  return { ok: true, value: sats }
}

export function parseFeeRateInput(value) {
  const normalized = String(value ?? '').trim()

  if (!/^[0-9]+(\.[0-9]+)?$/.test(normalized)) {
    return { ok: false, error: '请输入正数费率' }
  }

  const feeRate = Number(normalized)

  if (!Number.isFinite(feeRate) || feeRate <= 0) {
    return { ok: false, error: '费率必须大于 0' }
  }

  return { ok: true, value: feeRate }
}

export function validatePasswordInput(value) {
  const password = String(value ?? '')

  if (password.trim().length < 8) {
    return { ok: false, error: '密码至少需要 8 个字符' }
  }

  return { ok: true, value: password }
}

export function validateMnemonicInput(value, validateMnemonic) {
  const mnemonic = String(value ?? '').trim().replace(/\s+/g, ' ')

  if (mnemonic === '') {
    return { ok: false, error: '请输入助记词' }
  }

  if (typeof validateMnemonic === 'function' && !validateMnemonic(mnemonic)) {
    return { ok: false, error: '助记词无效' }
  }

  return { ok: true, value: mnemonic }
}

export function validateRecipientAddressShape(value) {
  const address = String(value ?? '').trim()

  if (address === '') {
    return { ok: false, error: '请输入收款地址' }
  }

  if (!TESTNET_ADDRESS_PATTERN.test(address)) {
    return { ok: false, error: '请输入测试网地址（tb1、m、n 或 2 开头）' }
  }

  return { ok: true, value: address }
}

export function formatSats(value) {
  if (!Number.isSafeInteger(value)) {
    return '0 sats'
  }

  return `${new Intl.NumberFormat('zh-CN').format(value)} sats`
}

export function formatTxTime(timestamp) {
  if (!Number.isSafeInteger(timestamp) || timestamp <= 0) {
    return '未确认'
  }

  return new Intl.DateTimeFormat('zh-CN', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'UTC',
  }).format(new Date(timestamp * 1000))
}

export function buildTestnetTxUrl(txid) {
  return `${TESTNET_EXPLORER_TX_BASE_URL}/${encodeURIComponent(String(txid ?? ''))}`
}
