import { describe, it, expect } from 'vitest'
import { createMempoolTestnetClient } from '../src/lib/client.js'

function jsonResponse(data, init = {}) {
  return {
    ok: init.ok ?? true,
    status: init.status ?? 200,
    json: async () => data,
  }
}

function textResponse(data, init = {}) {
  return {
    ok: init.ok ?? true,
    status: init.status ?? 200,
    text: async () => data,
  }
}

function createFakeFetch(responseOrFactory) {
  const calls = []
  const fetch = async (...args) => {
    calls.push(args)
    return typeof responseOrFactory === 'function'
      ? responseOrFactory(...args)
      : responseOrFactory
  }

  return { fetch, calls }
}

describe('mempool.space testnet client', () => {
  it('gets confirmed and unconfirmed balances from address stats', async () => {
    const { fetch, calls } = createFakeFetch(jsonResponse({
      chain_stats: {
        funded_txo_sum: 5000,
        spent_txo_sum: 1250,
      },
      mempool_stats: {
        funded_txo_sum: 700,
        spent_txo_sum: 200,
      },
    }))
    const client = createMempoolTestnetClient({ fetch })

    await expect(client.getBalance('tb1q test/address')).resolves.toEqual({
      confirmed: 3750,
      unconfirmed: 500,
    })
    expect(calls).toEqual([
      ['https://mempool.space/testnet/api/address/tb1q%20test%2Faddress', undefined],
    ])
  })

  it('uses a custom base URL without duplicate trailing slashes', async () => {
    const utxos = [{ txid: 'abc', vout: 0, value: 1200 }]
    const { fetch, calls } = createFakeFetch(jsonResponse(utxos))
    const client = createMempoolTestnetClient({
      fetch,
      baseUrl: 'https://example.test/api///',
    })

    await expect(client.getUtxos('tb1qabc')).resolves.toEqual(utxos)
    expect(calls).toEqual([
      ['https://example.test/api/address/tb1qabc/utxo', undefined],
    ])
  })

  it('gets transaction history for an address', async () => {
    const history = [{ txid: 'tx-1' }, { txid: 'tx-2' }]
    const { fetch, calls } = createFakeFetch(jsonResponse(history))
    const client = createMempoolTestnetClient({ fetch })

    await expect(client.getTxHistory('tb1qhistory')).resolves.toEqual(history)
    expect(calls).toEqual([
      ['https://mempool.space/testnet/api/address/tb1qhistory/txs', undefined],
    ])
  })

  it('broadcasts raw transaction hex with a text POST body', async () => {
    const { fetch, calls } = createFakeFetch(textResponse('broadcast-txid'))
    const client = createMempoolTestnetClient({ fetch })

    await expect(client.broadcastTx('0200000001')).resolves.toBe('broadcast-txid')
    expect(calls).toEqual([
      [
        'https://mempool.space/testnet/api/tx',
        {
          method: 'POST',
          headers: {
            'content-type': 'text/plain',
          },
          body: '0200000001',
        },
      ],
    ])
  })

  it('rejects HTTP errors with status context', async () => {
    const { fetch } = createFakeFetch(jsonResponse({}, { ok: false, status: 503 }))
    const client = createMempoolTestnetClient({ fetch })

    await expect(client.getBalance('tb1qdown')).rejects.toThrow(
      'mempool.space balance request failed with HTTP 503',
    )
  })

  it('rejects network errors with request context', async () => {
    const { fetch } = createFakeFetch(async () => {
      throw new Error('socket closed')
    })
    const client = createMempoolTestnetClient({ fetch })

    await expect(client.getUtxos('tb1qoffline')).rejects.toThrow(
      'mempool.space utxos request failed: socket closed',
    )
  })

  it('requires a fetch implementation', () => {
    const originalFetch = globalThis.fetch

    try {
      globalThis.fetch = undefined
      expect(() => createMempoolTestnetClient()).toThrow('A fetch implementation is required')
    } finally {
      globalThis.fetch = originalFetch
    }
  })
})
