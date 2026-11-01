// A minimal "stored" (uncompressed) zip writer for Judge0's additional_files (M9 file fixtures).
// Fixtures are a few hundred bytes, so skipping compression keeps this tiny and dependency-free.

const LOCAL_HEADER = 0x04034b50;
const CENTRAL_HEADER = 0x02014b50;
const END_OF_CENTRAL = 0x06054b50;
const ZIP_VERSION = 20;
const UTF8_NAMES_FLAG = 0x0800;

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

export function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

interface Entry {
  name: Uint8Array;
  data: Uint8Array;
  crc: number;
  offset: number;
}

function header(signature: number, entry: Entry, central: boolean): Uint8Array {
  const size = central ? 46 : 30;
  const out = new Uint8Array(size + entry.name.length);
  const view = new DataView(out.buffer);
  let at = 0;
  const u16 = (v: number) => {
    view.setUint16(at, v, true);
    at += 2;
  };
  const u32 = (v: number) => {
    view.setUint32(at, v, true);
    at += 4;
  };
  u32(signature);
  if (central) u16(ZIP_VERSION); // version made by
  u16(ZIP_VERSION); // version needed
  u16(UTF8_NAMES_FLAG);
  u16(0); // method: stored
  u16(0); // time
  u16(0); // date
  u32(entry.crc);
  u32(entry.data.length); // compressed size
  u32(entry.data.length); // uncompressed size
  u16(entry.name.length);
  u16(0); // extra field length
  if (central) {
    u16(0); // comment length
    u16(0); // disk number
    u16(0); // internal attributes
    u32(0); // external attributes
    u32(entry.offset);
  }
  out.set(entry.name, at);
  return out;
}

function concat(parts: readonly Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const part of parts) {
    out.set(part, at);
    at += part.length;
  }
  return out;
}

/** Builds a zip of UTF-8 text files: `{ "log.txt": "..." }`. */
export function storeZip(files: Readonly<Record<string, string>>): Uint8Array {
  const encoder = new TextEncoder();
  const locals: Uint8Array[] = [];
  const entries: Entry[] = [];
  let offset = 0;
  for (const [name, text] of Object.entries(files)) {
    const data = encoder.encode(text);
    const entry = { name: encoder.encode(name), data, crc: crc32(data), offset };
    const local = header(LOCAL_HEADER, entry, false);
    locals.push(local, data);
    entries.push(entry);
    offset += local.length + data.length;
  }
  const central = concat(entries.map((e) => header(CENTRAL_HEADER, e, true)));
  const end = new Uint8Array(22);
  const view = new DataView(end.buffer);
  view.setUint32(0, END_OF_CENTRAL, true);
  view.setUint16(8, entries.length, true);
  view.setUint16(10, entries.length, true);
  view.setUint32(12, central.length, true);
  view.setUint32(16, offset, true);
  return concat([...locals, central, end]);
}

export function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}
