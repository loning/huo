import {
  buildTestnetTxUrl,
  formatSats,
  formatTxTime,
  parseFeeRateInput,
  parseSatsInput,
  validateMnemonicInput,
  validatePasswordInput,
  validateRecipientAddressShape,
} from './form-utils.js'

const initialState = {
  mnemonic: '',
  account: null,
  balance: null,
  history: [],
  busy: '',
  notice: null,
  lastTxid: '',
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

function message(text, tone = 'info') {
  return { text, tone }
}

function renderNotice(notice) {
  if (!notice) return ''

  return `<p class="notice notice-${notice.tone}" role="status">${escapeHtml(notice.text)}</p>`
}

function renderBalance(balance) {
  if (!balance) {
    return '<p class="muted">尚未刷新余额。</p>'
  }

  const total = (balance.confirmed ?? 0) + (balance.unconfirmed ?? 0)

  return `
    <dl class="stat-grid">
      <div>
        <dt>确认余额</dt>
        <dd>${formatSats(balance.confirmed ?? 0)}</dd>
      </div>
      <div>
        <dt>未确认</dt>
        <dd>${formatSats(balance.unconfirmed ?? 0)}</dd>
      </div>
      <div>
        <dt>合计</dt>
        <dd>${formatSats(total)}</dd>
      </div>
    </dl>
  `
}

function renderHistory(history) {
  if (!history.length) {
    return '<p class="muted">暂无交易记录。</p>'
  }

  return `
    <ol class="history-list">
      ${history
        .slice(0, 8)
        .map((entry) => {
          const txid = entry.txid ?? ''
          const time = formatTxTime(entry.status?.block_time)

          return `
            <li>
              <a href="${buildTestnetTxUrl(txid)}" target="_blank" rel="noreferrer">${escapeHtml(txid)}</a>
              <span>${escapeHtml(time)}</span>
            </li>
          `
        })
        .join('')}
    </ol>
  `
}

function renderUnlocked(state) {
  const { account, busy, lastTxid } = state
  const isBusy = busy !== ''

  return `
    <section class="panel wallet-panel">
      <div>
        <p class="eyebrow">已解锁 · Bitcoin Testnet</p>
        <h2>收款地址</h2>
        <p class="address">${escapeHtml(account.address)}</p>
      </div>
      <canvas id="address-qr" class="qr" aria-label="测试网地址二维码"></canvas>
    </section>

    <section class="panel backup-panel">
      <p class="eyebrow">本地备份</p>
      <h2>助记词</h2>
      <p class="muted">仅在当前解锁会话显示。请离线保存，不要发送给任何人。</p>
      <textarea readonly rows="3">${escapeHtml(state.mnemonic)}</textarea>
    </section>

    <section class="panel">
      <div class="section-heading">
        <div>
          <p class="eyebrow">余额</p>
          <h2>账户状态</h2>
        </div>
        <button type="button" data-action="refresh" ${isBusy ? 'disabled' : ''}>刷新</button>
      </div>
      ${renderBalance(state.balance)}
    </section>

    <section class="panel">
      <p class="eyebrow">转账</p>
      <h2>发送测试网 BTC</h2>
      <form id="send-form" class="stack">
        <label>
          收款地址
          <input name="toAddress" autocomplete="off" placeholder="tb1..." required />
        </label>
        <div class="form-grid">
          <label>
            金额（sats）
            <input name="amountSats" inputmode="numeric" placeholder="1000" required />
          </label>
          <label>
            费率（sat/vB）
            <input name="feeRate" inputmode="decimal" value="1.5" required />
          </label>
        </div>
        <button type="submit" ${isBusy ? 'disabled' : ''}>构造、签名并广播</button>
      </form>
      ${
        lastTxid
          ? `<p class="success-link">已广播：<a href="${buildTestnetTxUrl(lastTxid)}" target="_blank" rel="noreferrer">${escapeHtml(lastTxid)}</a></p>`
          : ''
      }
    </section>

    <section class="panel">
      <p class="eyebrow">历史</p>
      <h2>最近交易</h2>
      ${renderHistory(state.history)}
    </section>

    <section class="panel danger-zone">
      <div>
        <p class="eyebrow">本地钱包</p>
        <h2>锁定与清除</h2>
        <p class="muted">锁定只清空当前会话；清除会删除浏览器 localStorage 中的加密钱包。</p>
      </div>
      <div class="button-row">
        <button type="button" data-action="lock">锁定</button>
        <button type="button" class="danger" data-action="clear">清除本地钱包</button>
      </div>
    </section>
  `
}

function renderLocked(state) {
  const isBusy = state.busy !== ''

  return `
    <section class="panel intro-panel">
      <p class="eyebrow">Bitcoin Testnet only</p>
      <h2>教学用途钱包</h2>
      <p>在浏览器中创建或导入测试网助记词，用密码加密保存到 localStorage。私钥不会发送到任何服务器。</p>
    </section>

    <section class="panel">
      <p class="eyebrow">新钱包</p>
      <h2>创建并保存</h2>
      <form id="create-form" class="stack">
        <label>
          本地加密密码
          <input name="password" type="password" autocomplete="new-password" minlength="8" required />
        </label>
        <button type="submit" ${isBusy ? 'disabled' : ''}>生成测试网钱包</button>
      </form>
    </section>

    <section class="panel">
      <p class="eyebrow">已有助记词</p>
      <h2>导入并保存</h2>
      <form id="import-form" class="stack">
        <label>
          助记词
          <textarea name="mnemonic" rows="4" autocomplete="off" placeholder="12 个英文单词" required></textarea>
        </label>
        <label>
          本地加密密码
          <input name="password" type="password" autocomplete="new-password" minlength="8" required />
        </label>
        <button type="submit" ${isBusy ? 'disabled' : ''}>导入测试网钱包</button>
      </form>
    </section>

    <section class="panel">
      <p class="eyebrow">已保存钱包</p>
      <h2>解锁</h2>
      <form id="unlock-form" class="stack">
        <label>
          本地加密密码
          <input name="password" type="password" autocomplete="current-password" minlength="8" required />
        </label>
        <button type="submit" ${isBusy ? 'disabled' : ''}>解锁本地钱包</button>
      </form>
    </section>
  `
}

function deriveAccount(keys, mnemonic) {
  return keys.mnemonicToAccount(mnemonic, 0)
}

function setUnlockedState(state, keys, mnemonic) {
  state.mnemonic = mnemonic
  state.account = deriveAccount(keys, mnemonic)
  state.balance = null
  state.history = []
  state.lastTxid = ''
}

async function refreshWallet(state, deps) {
  if (!state.account) return

  state.busy = 'refresh'
  state.notice = message('正在刷新余额和交易历史…')
  deps.render()

  try {
    const [balance, history] = await Promise.all([
      deps.client.getBalance(state.account.address),
      deps.client.getTxHistory(state.account.address),
    ])
    state.balance = balance
    state.history = Array.isArray(history) ? history : []
    state.notice = message('余额和交易历史已更新。', 'success')
  } catch (error) {
    state.notice = message(error.message, 'error')
  } finally {
    state.busy = ''
    deps.render()
  }
}

function bindForm(root, selector, handler) {
  root.querySelector(selector)?.addEventListener('submit', (event) => {
    event.preventDefault()
    handler(new FormData(event.currentTarget))
  })
}

export function mountWalletApp(root, deps) {
  if (!root) return

  const state = { ...initialState }
  const renderDeps = {
    ...deps,
    render,
  }

  async function createWallet(formData) {
    const password = validatePasswordInput(formData.get('password'))

    if (!password.ok) {
      state.notice = message(password.error, 'error')
      render()
      return
    }

    state.busy = 'create'
    state.notice = message('正在生成并加密保存测试网钱包…')
    render()

    try {
      const mnemonic = deps.keys.generateMnemonic()
      await deps.storage.saveWallet(mnemonic, password.value)
      setUnlockedState(state, deps.keys, mnemonic)
      state.notice = message('测试网钱包已创建并保存。请备份助记词。', 'success')
    } catch (error) {
      state.notice = message(error.message, 'error')
    } finally {
      state.busy = ''
      render()
    }
  }

  async function importWallet(formData) {
    const mnemonic = validateMnemonicInput(
      formData.get('mnemonic'),
      deps.keys.validateMnemonic,
    )
    const password = validatePasswordInput(formData.get('password'))

    if (!mnemonic.ok || !password.ok) {
      state.notice = message(mnemonic.error ?? password.error, 'error')
      render()
      return
    }

    state.busy = 'import'
    state.notice = message('正在加密保存导入的钱包…')
    render()

    try {
      await deps.storage.saveWallet(mnemonic.value, password.value)
      setUnlockedState(state, deps.keys, mnemonic.value)
      state.notice = message('钱包已导入并保存。', 'success')
    } catch (error) {
      state.notice = message(error.message, 'error')
    } finally {
      state.busy = ''
      render()
    }
  }

  async function unlockWallet(formData) {
    const password = validatePasswordInput(formData.get('password'))

    if (!password.ok) {
      state.notice = message(password.error, 'error')
      render()
      return
    }

    state.busy = 'unlock'
    state.notice = message('正在解锁本地钱包…')
    render()

    try {
      const mnemonic = await deps.storage.loadWallet(password.value)

      if (!mnemonic) {
        state.notice = message('没有找到已保存的钱包，请先创建或导入。', 'error')
      } else {
        setUnlockedState(state, deps.keys, mnemonic)
        state.notice = message('钱包已解锁。', 'success')
      }
    } catch {
      state.notice = message('解锁失败，请检查密码或本地钱包数据。', 'error')
    } finally {
      state.busy = ''
      render()
    }
  }

  async function sendTransaction(formData) {
    const recipient = validateRecipientAddressShape(formData.get('toAddress'))
    const amount = parseSatsInput(formData.get('amountSats'))
    const feeRate = parseFeeRateInput(formData.get('feeRate'))

    if (!recipient.ok || !amount.ok || !feeRate.ok) {
      state.notice = message(recipient.error ?? amount.error ?? feeRate.error, 'error')
      render()
      return
    }

    state.busy = 'send'
    state.notice = message('正在获取 UTXO、签名并广播交易…')
    render()

    try {
      const utxos = await deps.client.getUtxos(state.account.address)
      const built = deps.tx.buildAndSignTx({
        mnemonic: state.mnemonic,
        toAddress: recipient.value,
        amountSats: amount.value,
        utxos,
        feeRate: feeRate.value,
      })
      const txid = await deps.client.broadcastTx(built.rawTxHex)

      state.lastTxid = txid || built.txid
      state.notice = message(`交易已广播，矿工费 ${formatSats(built.feeSats)}。`, 'success')
      await refreshWallet(state, renderDeps)
    } catch (error) {
      state.notice = message(error.message, 'error')
    } finally {
      state.busy = ''
      render()
    }
  }

  function lockWallet() {
    state.mnemonic = ''
    state.account = null
    state.balance = null
    state.history = []
    state.lastTxid = ''
    state.notice = message('钱包已锁定。')
    render()
  }

  function clearWallet() {
    deps.storage.clearWallet()
    lockWallet()
    state.notice = message('本地加密钱包已清除。', 'success')
    render()
  }

  function renderQr() {
    const canvas = root.querySelector('#address-qr')

    if (canvas && state.account) {
      deps.QRCode.toCanvas(canvas, state.account.address, {
        width: 160,
        margin: 1,
        errorCorrectionLevel: 'M',
      })
    }
  }

  function bindEvents() {
    bindForm(root, '#create-form', createWallet)
    bindForm(root, '#import-form', importWallet)
    bindForm(root, '#unlock-form', unlockWallet)
    bindForm(root, '#send-form', sendTransaction)

    root.querySelector('[data-action="refresh"]')?.addEventListener('click', () => {
      refreshWallet(state, renderDeps)
    })
    root.querySelector('[data-action="lock"]')?.addEventListener('click', lockWallet)
    root.querySelector('[data-action="clear"]')?.addEventListener('click', clearWallet)
  }

  function render() {
    root.innerHTML = `
      ${renderNotice(state.notice)}
      <div class="app-grid">
        ${state.account ? renderUnlocked(state) : renderLocked(state)}
      </div>
    `
    bindEvents()
    renderQr()
  }

  render()
}
