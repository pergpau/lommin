import { MAX_IMPORT_BYTES } from "../constants";

const SALT_LEN = 16;
const IV_LEN = 12;
const ITER = 200_000;
const VERSION_COMPRESSED = 0x01;

async function deriveKey(passphrase: string, salt: Uint8Array<ArrayBuffer>): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(passphrase),
    "PBKDF2",
    false,
    ["deriveKey"],
  );
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations: ITER, hash: "SHA-256" },
    base,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

async function compress(data: Uint8Array<ArrayBuffer>): Promise<Uint8Array<ArrayBuffer>> {
  const cs = new CompressionStream("gzip");
  const writer = cs.writable.getWriter();
  writer.write(data);
  writer.close();
  return new Uint8Array(await new Response(cs.readable).arrayBuffer()) as Uint8Array<ArrayBuffer>;
}

async function decompress(data: Uint8Array<ArrayBuffer>): Promise<Uint8Array<ArrayBuffer>> {
  const ds = new DecompressionStream("gzip");
  const writer = ds.writable.getWriter();
  writer.write(data);
  writer.close();
  return new Uint8Array(await new Response(ds.readable).arrayBuffer()) as Uint8Array<ArrayBuffer>;
}

export async function encryptStore(data: object, passphrase: string): Promise<Uint8Array> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_LEN)) as Uint8Array<ArrayBuffer>;
  const iv = crypto.getRandomValues(new Uint8Array(IV_LEN)) as Uint8Array<ArrayBuffer>;
  const key = await deriveKey(passphrase, salt);
  const plaintext = await compress(new TextEncoder().encode(JSON.stringify(data)));
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, plaintext);

  const out = new Uint8Array(1 + SALT_LEN + IV_LEN + ciphertext.byteLength);
  out[0] = VERSION_COMPRESSED;
  out.set(salt, 1);
  out.set(iv, 1 + SALT_LEN);
  out.set(new Uint8Array(ciphertext), 1 + SALT_LEN + IV_LEN);
  return out as Uint8Array<ArrayBuffer>;
}

export async function decryptStore(blob: Uint8Array, passphrase: string): Promise<object> {
  const isCompressed = blob[0] === VERSION_COMPRESSED;
  const payload = isCompressed ? blob.slice(1) : blob;
  const salt = payload.slice(0, SALT_LEN);
  const iv = payload.slice(SALT_LEN, SALT_LEN + IV_LEN);
  const ciphertext = payload.slice(SALT_LEN + IV_LEN);
  const key = await deriveKey(passphrase, salt);
  const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ciphertext);
  const raw = new Uint8Array(plain) as Uint8Array<ArrayBuffer>;
  const bytes = isCompressed ? await decompress(raw) : raw;
  return JSON.parse(new TextDecoder().decode(bytes));
}

function hasFileSystemAccess(): boolean {
  return (
    typeof (window as unknown as { showSaveFilePicker?: unknown }).showSaveFilePicker === "function"
  );
}

export async function saveEncryptedFile(data: object, passphrase: string): Promise<void> {
  const blob = await encryptStore(data, passphrase);
  const file = new Blob([blob.buffer as ArrayBuffer], {
    type: "application/octet-stream",
  });

  if (hasFileSystemAccess()) {
    const handle = await (
      window as unknown as {
        showSaveFilePicker: (opts: object) => Promise<FileSystemFileHandle>;
      }
    ).showSaveFilePicker({
      suggestedName: "lommin.enc",
      types: [
        {
          description: "Lommin Backup",
          accept: { "application/octet-stream": [".enc"] },
        },
      ],
    });
    const writable = await handle.createWritable();
    await writable.write(file);
    await writable.close();
  } else {
    const url = URL.createObjectURL(file);
    const a = document.createElement("a");
    a.href = url;
    a.download = "lommin.enc";
    a.click();
    URL.revokeObjectURL(url);
  }
}

export async function loadEncryptedFile(passphrase: string): Promise<object> {
  let fileBuffer: ArrayBuffer;

  if (hasFileSystemAccess()) {
    const [handle] = await (
      window as unknown as {
        showOpenFilePicker: (opts: object) => Promise<FileSystemFileHandle[]>;
      }
    ).showOpenFilePicker({
      types: [
        {
          description: "Lommin Backup",
          accept: { "application/octet-stream": [".enc"] },
        },
      ],
    });
    const file = await handle.getFile();
    if (file.size > MAX_IMPORT_BYTES) throw new Error("File too large");
    fileBuffer = await file.arrayBuffer();
  } else {
    fileBuffer = await new Promise((resolve, reject) => {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = ".enc";
      input.onchange = () => {
        const file = input.files?.[0];
        if (!file) return reject(new Error("No file selected"));
        if (file.size > MAX_IMPORT_BYTES) return reject(new Error("File too large"));
        file.arrayBuffer().then(resolve).catch(reject);
      };
      input.click();
    });
  }

  return decryptStore(new Uint8Array(fileBuffer), passphrase);
}
