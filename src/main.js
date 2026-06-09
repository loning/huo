import './style.css'
import QRCode from 'qrcode'
import * as keys from './lib/keys.js'
import * as storage from './lib/storage.js'
import { createMempoolTestnetClient } from './lib/client.js'
import * as tx from './lib/tx.js'
import { mountWalletApp } from './ui/wallet-app.js'

const client = createMempoolTestnetClient()

if (typeof document !== 'undefined') {
  mountWalletApp(document.getElementById('main'), {
    keys,
    storage,
    client,
    tx,
    QRCode,
  })
}
