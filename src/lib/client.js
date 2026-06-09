const DEFAULT_BASE_URL = 'https://mempool.space/testnet/api'

function normalizeBaseUrl(baseUrl) {
  return String(baseUrl).replace(/\/+$/, '')
}

function buildUrl(baseUrl, path) {
  return `${baseUrl}${path}`
}

async function parseJsonResponse(response, resource) {
  if (!response.ok) {
    throw new Error(`mempool.space ${resource} request failed with HTTP ${response.status}`)
  }

  return response.json()
}

async function parseTextResponse(response, resource) {
  if (!response.ok) {
    throw new Error(`mempool.space ${resource} request failed with HTTP ${response.status}`)
  }

  return response.text()
}

async function request(fetchImpl, url, resource, options) {
  try {
    return await fetchImpl(url, options)
  } catch (error) {
    throw new Error(`mempool.space ${resource} request failed: ${error.message}`)
  }
}

/**
 * Creates a small mempool.space testnet API client for wallet network calls.
 * @param {{ fetch?: typeof globalThis.fetch, baseUrl?: string }} options
 */
export function createMempoolTestnetClient(options = {}) {
  const fetchImpl = options.fetch ?? globalThis.fetch

  if (typeof fetchImpl !== 'function') {
    throw new Error('A fetch implementation is required')
  }

  const baseUrl = normalizeBaseUrl(options.baseUrl ?? DEFAULT_BASE_URL)

  return {
    async getBalance(address) {
      const response = await request(
        fetchImpl,
        buildUrl(baseUrl, `/address/${encodeURIComponent(address)}`),
        'balance',
      )
      const data = await parseJsonResponse(response, 'balance')
      const chainStats = data.chain_stats ?? {}
      const mempoolStats = data.mempool_stats ?? {}

      return {
        confirmed: (chainStats.funded_txo_sum ?? 0) - (chainStats.spent_txo_sum ?? 0),
        unconfirmed: (mempoolStats.funded_txo_sum ?? 0) - (mempoolStats.spent_txo_sum ?? 0),
      }
    },

    async getUtxos(address) {
      const response = await request(
        fetchImpl,
        buildUrl(baseUrl, `/address/${encodeURIComponent(address)}/utxo`),
        'utxos',
      )

      return parseJsonResponse(response, 'utxos')
    },

    async getTxHistory(address) {
      const response = await request(
        fetchImpl,
        buildUrl(baseUrl, `/address/${encodeURIComponent(address)}/txs`),
        'transaction history',
      )

      return parseJsonResponse(response, 'transaction history')
    },

    async broadcastTx(hex) {
      const response = await request(
        fetchImpl,
        buildUrl(baseUrl, '/tx'),
        'broadcast',
        {
          method: 'POST',
          headers: {
            'content-type': 'text/plain',
          },
          body: hex,
        },
      )

      return parseTextResponse(response, 'broadcast')
    },
  }
}
