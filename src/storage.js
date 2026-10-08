/**
 * @fileoverview Utility module for Chrome local storage with TTL and encryption.
 */

/**
 * Stores a value in chrome.storage.local with an expiration time.
 * @param {string} key - The key under which the value is stored.
 * @param {any} value - The value to store.
 * @param {number} [ttlInMinutes=1440] - Time to live in minutes (default 24 hours).
 * @returns {Promise<void>}
 */
export const setWithExpiry = async (key, value, ttlInMinutes = 1440) => {
  try {
    const now = new Date();
    const item = {
      value: value,
      expiry: now.getTime() + ttlInMinutes * 60000,
    };
    await chrome.storage.local.set({ [key]: item });
  } catch (error) {
    console.error(`Error saving to storage with key ${key}:`, error);
  }
};

/**
 * Retrieves a value from chrome.storage.local, checking its TTL.
 * @param {string} key - The key to retrieve.
 * @returns {Promise<any|null>} The stored value, or null if expired or not found.
 */
export const getWithExpiry = async (key) => {
  try {
    const result = await chrome.storage.local.get(key);
    const item = result[key];
    
    if (!item) {
      return null;
    }
    
    const now = new Date();
    if (now.getTime() > item.expiry) {
      await chrome.storage.local.remove(key);
      return null;
    }
    
    return item.value;
  } catch (error) {
    console.error(`Error getting from storage with key ${key}:`, error);
    return null;
  }
};

/**
 * Retrieves or generates an AES-GCM encryption key.
 * @returns {Promise<CryptoKey>}
 */
const getEncryptionKey = async () => {
  const keyName = '__integrity_guard_enc_key';
  const result = await chrome.storage.local.get(keyName);
  let keyString = result[keyName];
  
  if (!keyString) {
    const key = await crypto.subtle.generateKey(
      { name: "AES-GCM", length: 256 },
      true,
      ["encrypt", "decrypt"]
    );
    const exported = await crypto.subtle.exportKey("raw", key);
    const exportedKeyBuffer = new Uint8Array(exported);
    keyString = btoa(String.fromCharCode(...exportedKeyBuffer));
    await chrome.storage.local.set({ [keyName]: keyString });
    return key;
  }
  
  const binaryDerString = atob(keyString);
  const binaryDer = new Uint8Array(binaryDerString.length);
  for (let i = 0; i < binaryDerString.length; i++) {
    binaryDer[i] = binaryDerString.charCodeAt(i);
  }
  
  return await crypto.subtle.importKey(
    "raw",
    binaryDer.buffer,
    { name: "AES-GCM" },
    true,
    ["encrypt", "decrypt"]
  );
};

/**
 * Encrypts data (e.g., Personal Access Token) using AES-GCM.
 * @param {string} text - The plaintext to encrypt.
 * @returns {Promise<{iv: string, content: string}|null>}
 */
export const encryptData = async (text) => {
  try {
    const key = await getEncryptionKey();
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encodedText = new TextEncoder().encode(text);
    
    const encryptedContent = await crypto.subtle.encrypt(
      { name: "AES-GCM", iv: iv },
      key,
      encodedText
    );
    
    const encryptedContentArray = Array.from(new Uint8Array(encryptedContent));
    const ivArray = Array.from(iv);
    
    return {
      iv: btoa(String.fromCharCode(...ivArray)),
      content: btoa(String.fromCharCode(...encryptedContentArray))
    };
  } catch (error) {
    console.error("Encryption failed:", error);
    return null;
  }
};

/**
 * Decrypts data using AES-GCM.
 * @param {{iv: string, content: string}} encryptedObj - The encrypted object.
 * @returns {Promise<string|null>} The decrypted plaintext.
 */
export const decryptData = async (encryptedObj) => {
  try {
    const key = await getEncryptionKey();
    
    const ivString = atob(encryptedObj.iv);
    const iv = new Uint8Array(ivString.length);
    for (let i = 0; i < ivString.length; i++) {
      iv[i] = ivString.charCodeAt(i);
    }
    
    const contentString = atob(encryptedObj.content);
    const content = new Uint8Array(contentString.length);
    for (let i = 0; i < contentString.length; i++) {
      content[i] = contentString.charCodeAt(i);
    }
    
    const decryptedContent = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: iv },
      key,
      content
    );
    
    return new TextDecoder().decode(decryptedContent);
  } catch (error) {
    console.error("Decryption failed:", error);
    return null;
  }
};
