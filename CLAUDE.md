# Huo · 比特币测试网钱包（项目规则）

本仓库由 `consensus-rnd:codex-refactor-loop` 无人值守共识循环驱动开发。本文件是
host-owned 规则文档，供 audit / solver / reviewer codex 读取。

## 产品

一个**纯前端、教学用途**的比特币钱包网页应用，部署到 GitHub Pages
（https://loning.github.io/huo/）。

## 顶级约束（硬约束）

- **默认仅测试网（testnet）**。除非有显式的、带醒目警告的 mainnet 开关，否则所有
  密钥生成、地址、交易、余额查询都走 Bitcoin testnet。
- **私钥永不离开浏览器**。本应用无后端；助记词/私钥只在客户端生成与存储
  （localStorage，最好口令加密），绝不通过网络发送给任何服务端或第三方。
- **UI 必须有醒目安全警告**：本钱包仅供学习/测试，请勿存入真实资金。
- **不引入后端服务**。余额/交易历史/广播只通过公开的 testnet 区块浏览器 API
  （如 blockstream.info/testnet/api 或 mempool.space testnet）只读/广播调用。
- 不在源码中硬编码任何真实主网私钥、API key 或个人信息。

## 技术栈

- 构建：Vite（`npm run build`，产物在 `dist/`，base 路径 `/huo/`）。
- 测试：Vitest（`npm test`）。
- 比特币：`bitcoinjs-lib` + `@bitcoinerlab/secp256k1` + `bip39` + `bip32` + `ecpair`。
- 二维码：`qrcode`。
- UI：原生 JS + DOM，保持轻量；不引入重型框架。

## 架构

- 纯逻辑（密钥派生、地址、交易构造、校验）放 `src/lib/`，必须有单元测试。
- DOM/UI 层保持薄；副作用（网络、localStorage）集中、可替换、可在测试中 mock。
- 网络访问统一走一个 client 模块，便于测试 stub。

## 工程约束

- 源文件（`.js`/`.ts`/`.css`）内的注释、日志、标识符用英文；面向用户的 UI 文案
  用中文。
- 测试用确定性断言，不用 `sleep`/计时凑过；不得用跳过/禁用测试换取 CI 绿。
- 改动只限当前 work-unit 的 scope。
- 构建与测试必须保持绿：`npm run build` 与 `npm test` 都要通过。

## 分支

- `main`：review 基线分支（GitHub Pages 从这里部署）。
- `auto-dev`：集成分支；各 work-unit 的 PR 先合到这里，再 rollup 到 `main`。

<!-- consensus-rnd:foundational-invariants:start version=1 sha256=f5c24b0c3515993a7b86c4ed78ce7386add665f8c8b84cc7275aedebd6c3e6af -->
## 共识研发不动点（由 consensus-rnd 管理）

- FI-001 AI 产物默认不可信；进入主线前必须经过独立检查，至少包含共识、review 或自动验证中的适用组合。
- FI-002 Host 事实必须由 host 配置或 host 规则注入；通用 skill / engine 不硬编码具体项目、组织、路径、分支或人员事实；skill-private runtime directories such as `.refactor-loop/` must not become host production configuration or ledger SSOT.
- FI-003 稳定核心保持小而可审计；高频变化留在 host 规则、prompt、脚本或扩展层，不下沉为核心不变量。
- FI-004 跨进程、跨 turn 或跨节点的事实必须有权威记录；进程内记忆、cache、临时变量不能冒充事实源。
- FI-005 边界优先于便利；职责、层级、协议和状态所有权必须清楚，禁止用中间层快捷方式绕过主链路。
- FI-006 变更必须可验证且基于 evidence；失败、缺口和越界承诺要显式暴露，禁止用静默假设或禁用测试换取通过。
- FI-007 删除优先；废弃路径直接移除，除非 host 规则明确要求迁移期兼容。
<!-- consensus-rnd:foundational-invariants:end -->
