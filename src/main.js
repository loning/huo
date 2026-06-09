// Entry point. The full wallet UI is built incrementally by the
// consensus-rnd codex-refactor-loop via design issues.
import { describeNetwork } from './lib/wallet.js'

function render() {
  const main = document.getElementById('main')
  if (!main) return
  main.innerHTML = `
    <section>
      <h2>状态</h2>
      <p>当前网络：<strong>${describeNetwork('testnet')}</strong></p>
      <p>钱包功能开发中，由无人值守共识循环逐步交付。</p>
    </section>
  `
}

if (typeof document !== 'undefined') {
  render()
}
