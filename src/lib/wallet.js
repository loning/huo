// Pure, framework-free wallet helpers. Kept dependency-light so it is easy to
// unit test. Bitcoin key/address/tx logic is added incrementally by the loop.

const NETWORKS = {
  testnet: 'Bitcoin Testnet',
  mainnet: 'Bitcoin Mainnet',
}

/**
 * Human-readable label for a supported Bitcoin network id.
 * @param {string} id
 * @returns {string}
 */
export function describeNetwork(id) {
  return NETWORKS[id] ?? 'Unknown Network'
}

/**
 * Whether the given network id is supported by this wallet.
 * @param {string} id
 * @returns {boolean}
 */
export function isSupportedNetwork(id) {
  return Object.prototype.hasOwnProperty.call(NETWORKS, id)
}
