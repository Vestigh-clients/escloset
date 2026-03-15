const crcTable = (() => {
  const table = new Uint32Array(256);

  for (let i = 0; i < 256; i += 1) {
    let c = i;
    for (let j = 0; j < 8; j += 1) {
      c = (c & 1) ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[i] = c >>> 0;
  }

  return table;
})();

const crc32 = (data: Uint8Array) => {
  let crc = 0xffffffff;
  for (let i = 0; i < data.length; i += 1) {
    crc = crcTable[(crc ^ data[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
};

interface ZipEntryInput {
  name: string;
  content: string;
}

interface EncodedEntry {
  nameBytes: Uint8Array;
  dataBytes: Uint8Array;
  crc: number;
}

const encoder = new TextEncoder();

const writeUint16 = (target: Uint8Array, offset: number, value: number) => {
  target[offset] = value & 0xff;
  target[offset + 1] = (value >>> 8) & 0xff;
};

const writeUint32 = (target: Uint8Array, offset: number, value: number) => {
  target[offset] = value & 0xff;
  target[offset + 1] = (value >>> 8) & 0xff;
  target[offset + 2] = (value >>> 16) & 0xff;
  target[offset + 3] = (value >>> 24) & 0xff;
};

export const buildZipBlob = (entries: ZipEntryInput[]): Blob => {
  const normalized: EncodedEntry[] = entries.map((entry) => {
    const nameBytes = encoder.encode(entry.name);
    const dataBytes = encoder.encode(entry.content);
    return {
      nameBytes,
      dataBytes,
      crc: crc32(dataBytes),
    };
  });

  const localParts: Uint8Array[] = [];
  const centralParts: Uint8Array[] = [];
  let localOffset = 0;

  normalized.forEach((entry) => {
    const localHeader = new Uint8Array(30 + entry.nameBytes.length);
    writeUint32(localHeader, 0, 0x04034b50);
    writeUint16(localHeader, 4, 20);
    writeUint16(localHeader, 6, 0);
    writeUint16(localHeader, 8, 0);
    writeUint16(localHeader, 10, 0);
    writeUint16(localHeader, 12, 0);
    writeUint32(localHeader, 14, entry.crc);
    writeUint32(localHeader, 18, entry.dataBytes.length);
    writeUint32(localHeader, 22, entry.dataBytes.length);
    writeUint16(localHeader, 26, entry.nameBytes.length);
    writeUint16(localHeader, 28, 0);
    localHeader.set(entry.nameBytes, 30);
    localParts.push(localHeader, entry.dataBytes);

    const centralHeader = new Uint8Array(46 + entry.nameBytes.length);
    writeUint32(centralHeader, 0, 0x02014b50);
    writeUint16(centralHeader, 4, 20);
    writeUint16(centralHeader, 6, 20);
    writeUint16(centralHeader, 8, 0);
    writeUint16(centralHeader, 10, 0);
    writeUint16(centralHeader, 12, 0);
    writeUint16(centralHeader, 14, 0);
    writeUint32(centralHeader, 16, entry.crc);
    writeUint32(centralHeader, 20, entry.dataBytes.length);
    writeUint32(centralHeader, 24, entry.dataBytes.length);
    writeUint16(centralHeader, 28, entry.nameBytes.length);
    writeUint16(centralHeader, 30, 0);
    writeUint16(centralHeader, 32, 0);
    writeUint16(centralHeader, 34, 0);
    writeUint16(centralHeader, 36, 0);
    writeUint32(centralHeader, 38, 0);
    writeUint32(centralHeader, 42, localOffset);
    centralHeader.set(entry.nameBytes, 46);
    centralParts.push(centralHeader);

    localOffset += localHeader.length + entry.dataBytes.length;
  });

  const centralSize = centralParts.reduce((sum, part) => sum + part.length, 0);
  const centralOffset = localOffset;

  const end = new Uint8Array(22);
  writeUint32(end, 0, 0x06054b50);
  writeUint16(end, 4, 0);
  writeUint16(end, 6, 0);
  writeUint16(end, 8, normalized.length);
  writeUint16(end, 10, normalized.length);
  writeUint32(end, 12, centralSize);
  writeUint32(end, 16, centralOffset);
  writeUint16(end, 20, 0);

  return new Blob([...localParts, ...centralParts, end], {
    type: "application/zip",
  });
};

