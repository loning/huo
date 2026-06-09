const STORAGE_KEY = 'huo.wallet.v1'
const ENVELOPE_VERSION = 1
const KDF = 'PBKDF2'
const HASH = 'SHA-256'
const ITERATIONS = 600000
const CIPHER = 'AES-GCM'
const KEY_LENGTH_BITS = 256
const SALT_BYTES = 16
const IV_BYTES = 12

const textEncoder = new TextEncoder()
const textDecoder = new TextDecoder()

function getCrypto() {
  const cryptoImpl = globalThis.crypto
  if (!cryptoImpl?.subtle || typeof cryptoImpl.getRandomValues !== 'function') {
    throw new Error('WebCrypto is not available')
  }
  return cryptoImpl
}

function getStorage(storage) {
  const storageImpl = storage ?? globalThis.localStorage
  if (
    !storageImpl ||
    typeof storageImpl.getItem !== 'function' ||
    typeof storageImpl.setItem !== 'function' ||
    typeof storageImpl.removeItem !== 'function'
  ) {
    throw new Error('Wallet storage is not available')
  }
  return storageImpl
}

function bytesToBase64(bytes) {
  let binary = ''
  for (const byte of bytes) {
    binary += String.fromCharCode(byte)
  }

  if (typeof btoa === 'function') {
    return btoa(binary)
  }

  return Buffer.from(binary, 'binary').toString('base64')
}

function base64ToBytes(value) {
  const binary =
    typeof atob === 'function'
      ? atob(value)
      : Buffer.from(value, 'base64').toString('binary')
  const bytes = new Uint8Array(binary.length)

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index)
  }

  return bytes
}

async function deriveKey(password, salt, iterations) {
  const cryptoImpl = getCrypto()
  const baseKey = await cryptoImpl.subtle.importKey(
    'raw',
    textEncoder.encode(password),
    KDF,
    false,
    ['deriveKey'],
  )

  return cryptoImpl.subtle.deriveKey(
    {
      name: KDF,
      salt,
      iterations,
      hash: HASH,
    },
    baseKey,
    {
      name: CIPHER,
      length: KEY_LENGTH_BITS,
    },
    false,
    ['encrypt', 'decrypt'],
  )
}

function validateEnvelope(envelope) {
  if (!envelope || typeof envelope !== 'object') {
    throw new Error('Invalid wallet envelope')
  }

  if (
    envelope.version !== ENVELOPE_VERSION ||
    envelope.kdf !== KDF ||
    envelope.hash !== HASH ||
    envelope.iterations !== ITERATIONS ||
    envelope.cipher !== CIPHER ||
    typeof envelope.salt !== 'string' ||
    typeof envelope.iv !== 'string' ||
    typeof envelope.ciphertext !== 'string'
  ) {
    throw new Error('Invalid wallet envelope')
  }
}

export async function encryptMnemonic(mnemonic, password) {
  const cryptoImpl = getCrypto()
  const salt = new Uint8Array(SALT_BYTES)
  const iv = new Uint8Array(IV_BYTES)
  cryptoImpl.getRandomValues(salt)
  cryptoImpl.getRandomValues(iv)

  const key = await deriveKey(password, salt, ITERATIONS)
  const ciphertext = await cryptoImpl.subtle.encrypt(
    {
      name: CIPHER,
      iv,
    },
    key,
    textEncoder.encode(mnemonic),
  )

  return {
    version: ENVELOPE_VERSION,
    kdf: KDF,
    hash: HASH,
    iterations: ITERATIONS,
    salt: bytesToBase64(salt),
    cipher: CIPHER,
    iv: bytesToBase64(iv),
    ciphertext: bytesToBase64(new Uint8Array(ciphertext)),
  }
}

export async function decryptMnemonic(envelope, password) {
  validateEnvelope(envelope)

  const salt = base64ToBytes(envelope.salt)
  const iv = base64ToBytes(envelope.iv)
  const ciphertext = base64ToBytes(envelope.ciphertext)
  const key = await deriveKey(password, salt, envelope.iterations)
  const plaintext = await getCrypto().subtle.decrypt(
    {
      name: envelope.cipher,
      iv,
    },
    key,
    ciphertext,
  )

  return textDecoder.decode(plaintext)
}

export async function saveWallet(mnemonic, password, storage) {
  const storageImpl = getStorage(storage)
  const envelope = await encryptMnemonic(mnemonic, password)
  storageImpl.setItem(STORAGE_KEY, JSON.stringify(envelope))
  return envelope
}

export async function loadWallet(password, storage) {
  const storageImpl = getStorage(storage)
  const storedWallet = storageImpl.getItem(STORAGE_KEY)
  if (storedWallet === null) {
    return null
  }

  return decryptMnemonic(JSON.parse(storedWallet), password)
}

export function clearWallet(storage) {
  getStorage(storage).removeItem(STORAGE_KEY)
}
