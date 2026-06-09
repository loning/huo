import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mountWalletApp } from '../src/ui/wallet-app.js'

const CREATE_MNEMONIC = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about'
const IMPORT_MNEMONIC = 'legal winner thank year wave sausage worth useful legal winner thank yellow'
const UNLOCK_MNEMONIC = 'letter advice cage absurd amount doctor acoustic avoid letter advice cage above'
const SOURCE_ADDRESS = 'tb1qsource00000000000000000000000000000000'
const RECIPIENT_ADDRESS = 'tb1q6rz28mcfaxtmd6v789l9rrlrusdprr9pqcpvkl'

class FakeElement {
  constructor({ fields = {}, attrs = {} } = {}) {
    this.fields = fields
    this.attrs = attrs
    this.listeners = new Map()
  }

  addEventListener(type, handler) {
    this.listeners.set(type, handler)
  }

  setField(name, value) {
    this.fields[name] = value
  }

  submit() {
    const handler = this.listeners.get('submit')
    if (!handler) throw new Error('submit listener was not bound')

    return handler({
      currentTarget: this,
      preventDefault() {},
    })
  }

  click() {
    const handler = this.listeners.get('click')
    if (!handler) throw new Error('click listener was not bound')

    return handler({
      currentTarget: this,
      preventDefault() {},
    })
  }
}

class FakeRoot {
  constructor() {
    this.elements = new Map()
    this._innerHTML = ''
  }

  get innerHTML() {
    return this._innerHTML
  }

  set innerHTML(html) {
    this._innerHTML = html
    this.elements = parseElements(html)
  }

  querySelector(selector) {
    return this.elements.get(selector) ?? null
  }
}

class FakeFormData {
  constructor(form) {
    this.form = form
  }

  get(name) {
    return this.form.fields[name] ?? null
  }
}

function parseElements(html) {
  const elements = new Map()

  for (const match of html.matchAll(/<form\b[^>]*id="([^"]+)"[^>]*>([\s\S]*?)<\/form>/g)) {
    const [, id, body] = match
    elements.set(`#${id}`, new FakeElement({ fields: parseFormFields(body) }))
  }

  for (const match of html.matchAll(/<button\b[^>]*data-action="([^"]+)"[^>]*>/g)) {
    elements.set(`[data-action="${match[1]}"]`, new FakeElement())
  }

  for (const match of html.matchAll(/<canvas\b[^>]*id="([^"]+)"[^>]*>/g)) {
    elements.set(`#${match[1]}`, new FakeElement({ attrs: { id: match[1] } }))
  }

  return elements
}

function parseFormFields(body) {
  const fields = {}

  for (const match of body.matchAll(/<input\b([^>]*)>/g)) {
    const attrs = match[1]
    const name = attr(attrs, 'name')

    if (name) {
      fields[name] = attr(attrs, 'value') ?? ''
    }
  }

  for (const match of body.matchAll(/<textarea\b([^>]*)>([\s\S]*?)<\/textarea>/g)) {
    const name = attr(match[1], 'name')

    if (name) {
      fields[name] = match[2] ?? ''
    }
  }

  return fields
}

function attr(attrs, name) {
  const match = attrs.match(new RegExp(`\\b${name}="([^"]*)"`, 'u'))
  return match?.[1]
}

function createDeps(overrides = {}) {
  const deps = {
    keys: {
      generateMnemonic: vi.fn(() => CREATE_MNEMONIC),
      validateMnemonic: vi.fn((mnemonic) => mnemonic === IMPORT_MNEMONIC),
      mnemonicToAccount: vi.fn(() => ({ address: SOURCE_ADDRESS })),
    },
    storage: {
      saveWallet: vi.fn(async () => undefined),
      loadWallet: vi.fn(async () => UNLOCK_MNEMONIC),
      clearWallet: vi.fn(),
    },
    client: {
      getBalance: vi.fn(async () => ({ confirmed: 0, unconfirmed: 0 })),
      getTxHistory: vi.fn(async () => []),
      getUtxos: vi.fn(async () => [{ txid: 'funding-tx', vout: 0, value: 10_000 }]),
      broadcastTx: vi.fn(async () => 'network-txid'),
    },
    tx: {
      buildAndSignTx: vi.fn(() => ({
        rawTxHex: '0200000001',
        txid: 'built-txid',
        feeSats: 141,
      })),
    },
    QRCode: {
      toCanvas: vi.fn(),
    },
  }

  return {
    ...deps,
    ...overrides,
    keys: { ...deps.keys, ...overrides.keys },
    storage: { ...deps.storage, ...overrides.storage },
    client: { ...deps.client, ...overrides.client },
    tx: { ...deps.tx, ...overrides.tx },
    QRCode: { ...deps.QRCode, ...overrides.QRCode },
  }
}

async function submit(root, selector, fields) {
  const form = root.querySelector(selector)

  for (const [name, value] of Object.entries(fields)) {
    form.setField(name, value)
  }

  await form.submit()
}

async function unlock(root, deps, password = 'testnet password') {
  mountWalletApp(root, deps)
  await submit(root, '#unlock-form', { password })
}

describe('wallet app controller', () => {
  const OriginalFormData = globalThis.FormData

  beforeEach(() => {
    globalThis.FormData = FakeFormData
  })

  afterEach(() => {
    globalThis.FormData = OriginalFormData
  })

  it('rejects invalid create, import, and unlock submissions before side effects', async () => {
    const deps = createDeps()
    const root = new FakeRoot()
    mountWalletApp(root, deps)

    await submit(root, '#create-form', { password: 'short' })
    expect(root.innerHTML).toContain('密码至少需要 8 个字符')
    expect(deps.keys.generateMnemonic).not.toHaveBeenCalled()
    expect(deps.storage.saveWallet).not.toHaveBeenCalled()

    await submit(root, '#import-form', {
      mnemonic: 'bad mnemonic',
      password: 'testnet password',
    })
    expect(root.innerHTML).toContain('助记词无效')
    expect(deps.storage.saveWallet).not.toHaveBeenCalled()

    await submit(root, '#unlock-form', { password: 'short' })
    expect(root.innerHTML).toContain('密码至少需要 8 个字符')
    expect(deps.storage.loadWallet).not.toHaveBeenCalled()
  })

  it('creates a wallet, saves it, renders the unlocked state, and generates a QR code', async () => {
    const deps = createDeps()
    const root = new FakeRoot()
    mountWalletApp(root, deps)

    await submit(root, '#create-form', { password: 'testnet password' })

    expect(deps.storage.saveWallet).toHaveBeenCalledWith(CREATE_MNEMONIC, 'testnet password')
    expect(deps.keys.mnemonicToAccount).toHaveBeenCalledWith(CREATE_MNEMONIC, 0)
    expect(root.innerHTML).toContain(SOURCE_ADDRESS)
    expect(root.innerHTML).toContain(CREATE_MNEMONIC)
    expect(root.innerHTML).toContain('测试网钱包已创建并保存')
    expect(deps.QRCode.toCanvas).toHaveBeenLastCalledWith(
      root.querySelector('#address-qr'),
      SOURCE_ADDRESS,
      {
        width: 160,
        margin: 1,
        errorCorrectionLevel: 'M',
      },
    )
  })

  it('imports a valid mnemonic and renders the saved unlocked wallet', async () => {
    const deps = createDeps()
    const root = new FakeRoot()
    mountWalletApp(root, deps)

    await submit(root, '#import-form', {
      mnemonic: IMPORT_MNEMONIC,
      password: 'testnet password',
    })

    expect(deps.storage.saveWallet).toHaveBeenCalledWith(IMPORT_MNEMONIC, 'testnet password')
    expect(deps.keys.mnemonicToAccount).toHaveBeenCalledWith(IMPORT_MNEMONIC, 0)
    expect(root.innerHTML).toContain(SOURCE_ADDRESS)
    expect(root.innerHTML).toContain(IMPORT_MNEMONIC)
    expect(root.innerHTML).toContain('钱包已导入并保存')
  })

  it('unlocks a saved wallet and renders its address and mnemonic', async () => {
    const deps = createDeps()
    const root = new FakeRoot()

    await unlock(root, deps)

    expect(deps.storage.loadWallet).toHaveBeenCalledWith('testnet password')
    expect(deps.keys.mnemonicToAccount).toHaveBeenCalledWith(UNLOCK_MNEMONIC, 0)
    expect(root.innerHTML).toContain(SOURCE_ADDRESS)
    expect(root.innerHTML).toContain(UNLOCK_MNEMONIC)
    expect(root.innerHTML).toContain('钱包已解锁')
  })

  it('refreshes balance and history after unlock', async () => {
    const deps = createDeps({
      client: {
        getBalance: vi.fn(async () => ({ confirmed: 1234, unconfirmed: 66 })),
        getTxHistory: vi.fn(async () => [
          { txid: 'abc/123', status: { block_time: 1_700_000_000 } },
        ]),
      },
    })
    const root = new FakeRoot()
    await unlock(root, deps)

    await root.querySelector('[data-action="refresh"]').click()

    expect(deps.client.getBalance).toHaveBeenCalledWith(SOURCE_ADDRESS)
    expect(deps.client.getTxHistory).toHaveBeenCalledWith(SOURCE_ADDRESS)
    expect(root.innerHTML).toContain('1,234 sats')
    expect(root.innerHTML).toContain('66 sats')
    expect(root.innerHTML).toContain('1,300 sats')
    expect(root.innerHTML).toContain('https://mempool.space/testnet/tx/abc%2F123')
    expect(root.innerHTML).toContain('余额和交易历史已更新')
  })

  it('renders refresh errors without losing the unlocked wallet', async () => {
    const deps = createDeps({
      client: {
        getBalance: vi.fn(async () => {
          throw new Error('mempool unavailable')
        }),
      },
    })
    const root = new FakeRoot()
    await unlock(root, deps)

    await root.querySelector('[data-action="refresh"]').click()

    expect(root.innerHTML).toContain('mempool unavailable')
    expect(root.innerHTML).toContain(SOURCE_ADDRESS)
    expect(root.innerHTML).toContain('尚未刷新余额')
  })

  it('rejects invalid send submissions before network or signing calls', async () => {
    const deps = createDeps()
    const root = new FakeRoot()
    await unlock(root, deps)

    await submit(root, '#send-form', {
      toAddress: 'bc1q6rz28mcfaxtmd6v789l9rrlrusdprr9p4j6883',
      amountSats: '1000',
      feeRate: '1.5',
    })

    expect(root.innerHTML).toContain('请输入测试网地址')
    expect(deps.client.getUtxos).not.toHaveBeenCalled()
    expect(deps.tx.buildAndSignTx).not.toHaveBeenCalled()
    expect(deps.client.broadcastTx).not.toHaveBeenCalled()
  })

  it('builds, broadcasts, refreshes, and renders the fallback transaction link on send success', async () => {
    const deps = createDeps({
      client: {
        broadcastTx: vi.fn(async () => ''),
        getBalance: vi.fn(async () => ({ confirmed: 9000, unconfirmed: 0 })),
        getTxHistory: vi.fn(async () => []),
      },
    })
    const root = new FakeRoot()
    await unlock(root, deps)

    await submit(root, '#send-form', {
      toAddress: RECIPIENT_ADDRESS,
      amountSats: '1000',
      feeRate: '1.5',
    })

    expect(deps.client.getUtxos).toHaveBeenCalledWith(SOURCE_ADDRESS)
    expect(deps.tx.buildAndSignTx).toHaveBeenCalledWith({
      mnemonic: UNLOCK_MNEMONIC,
      toAddress: RECIPIENT_ADDRESS,
      amountSats: 1000,
      utxos: [{ txid: 'funding-tx', vout: 0, value: 10_000 }],
      feeRate: 1.5,
    })
    expect(deps.client.broadcastTx).toHaveBeenCalledWith('0200000001')
    expect(deps.client.getBalance).toHaveBeenCalledWith(SOURCE_ADDRESS)
    expect(root.innerHTML).toContain('https://mempool.space/testnet/tx/built-txid')
    expect(root.innerHTML).toContain('余额和交易历史已更新')
  })

  it('locks and clears wallet state through the rendered controls', async () => {
    const deps = createDeps()
    const root = new FakeRoot()
    await unlock(root, deps)

    root.querySelector('[data-action="lock"]').click()
    expect(root.innerHTML).toContain('钱包已锁定')
    expect(root.innerHTML).toContain('生成测试网钱包')
    expect(root.innerHTML).not.toContain(UNLOCK_MNEMONIC)

    await unlock(root, deps)
    root.querySelector('[data-action="clear"]').click()
    expect(deps.storage.clearWallet).toHaveBeenCalled()
    expect(root.innerHTML).toContain('本地加密钱包已清除')
    expect(root.innerHTML).toContain('生成测试网钱包')
    expect(root.innerHTML).not.toContain(UNLOCK_MNEMONIC)
  })
})
