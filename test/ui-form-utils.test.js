import { describe, expect, it } from 'vitest'
import {
  buildTestnetTxUrl,
  formatSats,
  formatTxTime,
  parseFeeRateInput,
  parseSatsInput,
  validateMnemonicInput,
  validatePasswordInput,
  validateRecipientAddressShape,
} from '../src/ui/form-utils.js'

describe('wallet UI form helpers', () => {
  it('parses positive safe-integer satoshi amounts', () => {
    expect(parseSatsInput(' 1500 ')).toEqual({ ok: true, value: 1500 })
    expect(parseSatsInput('0')).toEqual({
      ok: false,
      error: '金额必须是安全范围内的正整数聪数',
    })
    expect(parseSatsInput('1.5')).toEqual({
      ok: false,
      error: '请输入正整数聪数',
    })
    expect(parseSatsInput(String(Number.MAX_SAFE_INTEGER + 1))).toEqual({
      ok: false,
      error: '金额必须是安全范围内的正整数聪数',
    })
  })

  it('parses positive decimal fee rates', () => {
    expect(parseFeeRateInput(' 2.5 ')).toEqual({ ok: true, value: 2.5 })
    expect(parseFeeRateInput('0')).toEqual({
      ok: false,
      error: '费率必须大于 0',
    })
    expect(parseFeeRateInput('fast')).toEqual({
      ok: false,
      error: '请输入正数费率',
    })
  })

  it('validates password and mnemonic inputs before side effects', () => {
    expect(validatePasswordInput('1234567')).toEqual({
      ok: false,
      error: '密码至少需要 8 个字符',
    })
    expect(validatePasswordInput('testnet password')).toEqual({
      ok: true,
      value: 'testnet password',
    })

    expect(validateMnemonicInput('   ', () => true)).toEqual({
      ok: false,
      error: '请输入助记词',
    })
    expect(validateMnemonicInput('abandon  abandon', () => true)).toEqual({
      ok: true,
      value: 'abandon abandon',
    })
    expect(validateMnemonicInput('bad mnemonic', () => false)).toEqual({
      ok: false,
      error: '助记词无效',
    })
  })

  it('rejects malformed or mainnet-looking recipient addresses early', () => {
    expect(validateRecipientAddressShape('tb1q6rz28mcfaxtmd6v789l9rrlrusdprr9pqcpvkl')).toEqual({
      ok: true,
      value: 'tb1q6rz28mcfaxtmd6v789l9rrlrusdprr9pqcpvkl',
    })
    expect(validateRecipientAddressShape('')).toEqual({
      ok: false,
      error: '请输入收款地址',
    })
    expect(validateRecipientAddressShape('bc1q6rz28mcfaxtmd6v789l9rrlrusdprr9p4j6883')).toEqual({
      ok: false,
      error: '请输入测试网地址（tb1、m、n 或 2 开头）',
    })
  })

  it('formats satoshi balances and transaction times for display', () => {
    expect(formatSats(1234567)).toBe('1,234,567 sats')
    expect(formatSats(1.5)).toBe('0 sats')
    expect(formatTxTime(undefined)).toBe('未确认')
    expect(formatTxTime(1_700_000_000)).toContain('2023')
  })

  it('builds encoded testnet explorer transaction links', () => {
    expect(buildTestnetTxUrl('abc/123')).toBe(
      'https://mempool.space/testnet/tx/abc%2F123',
    )
  })
})
