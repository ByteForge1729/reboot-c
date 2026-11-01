import { describe, expect, test } from "vitest";
import { bytesToBase64, crc32, storeZip } from "./zip";

/** Independent reader: walks the central directory like unzip does, checking each entry's CRC. */
function readStoredZip(zip: Uint8Array): Record<string, string> {
  const view = new DataView(zip.buffer, zip.byteOffset, zip.byteLength);
  const end = zip.length - 22;
  expect(view.getUint32(end, true)).toBe(0x06054b50);
  const count = view.getUint16(end + 10, true);
  let at = view.getUint32(end + 16, true);
  const decoder = new TextDecoder();
  const out: Record<string, string> = {};
  for (let i = 0; i < count; i++) {
    expect(view.getUint32(at, true)).toBe(0x02014b50);
    const crc = view.getUint32(at + 16, true);
    const size = view.getUint32(at + 20, true);
    const nameLength = view.getUint16(at + 28, true);
    const local = view.getUint32(at + 42, true);
    const name = decoder.decode(zip.slice(at + 46, at + 46 + nameLength));
    expect(view.getUint32(local, true)).toBe(0x04034b50);
    const dataStart = local + 30 + view.getUint16(local + 26, true) + view.getUint16(local + 28, true);
    const data = zip.slice(dataStart, dataStart + size);
    expect(crc32(data)).toBe(crc);
    out[name] = decoder.decode(data);
    at += 46 + nameLength;
  }
  return out;
}

describe("crc32", () => {
  test("matches the standard check values", () => {
    expect(crc32(new TextEncoder().encode("123456789"))).toBe(0xcbf43926);
    expect(crc32(new Uint8Array())).toBe(0);
  });
});

describe("storeZip", () => {
  test("lists every file in the central directory with its offset, size and CRC", () => {
    const files = { "log.txt": "ERROR disk\nINFO ok\n", "crew.csv": "Asha,31\nRavi°,27\n" };

    const zip = storeZip(files);

    expect(readStoredZip(zip)).toEqual(files);
  });

  test("handles an empty file", () => {
    const zip = storeZip({ "empty.txt": "" });
    expect(Array.from(zip.slice(0, 4))).toEqual([0x50, 0x4b, 0x03, 0x04]);
  });
});

describe("bytesToBase64", () => {
  test("encodes raw bytes, including ones above 127", () => {
    expect(bytesToBase64(new Uint8Array([0, 255, 80]))).toBe("AP9Q");
  });
});
