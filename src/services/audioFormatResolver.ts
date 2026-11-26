import type { AudioData } from '@audio/decode';

export interface ResolvedAudioMeta {
  extension: string;
  mimeType: string;
  decoderKey?: string;
}

const FORMAT_MIME_MAP: Record<string, { mime: string; alternates?: string[]; decoder?: string }> = {
  mp3: { mime: 'audio/mpeg', alternates: ['audio/mp3'], decoder: 'mp3' },
  mpga: { mime: 'audio/mpeg', decoder: 'mp3' },
  mp2: { mime: 'audio/mpeg', decoder: 'mp3' },
  mp1: { mime: 'audio/mpeg', decoder: 'mp3' },
  mpeg: { mime: 'audio/mpeg', decoder: 'mp3' },
  m4a: { mime: 'audio/mp4', alternates: ['audio/x-m4a', 'audio/mp4; codecs="mp4a.40.2"'], decoder: 'm4a' },
  m4b: { mime: 'audio/mp4', alternates: ['audio/mp4; codecs="mp4a.40.2"'], decoder: 'm4a' },
  m4p: { mime: 'audio/mp4', decoder: 'm4a' },
  m4r: { mime: 'audio/mp4', decoder: 'm4a' },
  mp4: { mime: 'audio/mp4', alternates: ['audio/mp4; codecs="mp4a.40.2"'], decoder: 'mp4' },
  mov: { mime: 'video/quicktime', alternates: ['audio/mp4'], decoder: 'mov' },
  aac: { mime: 'audio/aac', alternates: ['audio/x-aac', 'audio/adts', 'audio/mp4; codecs="mp4a.40.2"'], decoder: 'aac' },
  adts: { mime: 'audio/aac', decoder: 'aac' },
  wav: { mime: 'audio/wav', alternates: ['audio/wave', 'audio/x-wav'], decoder: 'wav' },
  wave: { mime: 'audio/wav', decoder: 'wav' },
  ogg: { mime: 'audio/ogg', alternates: ['audio/ogg; codecs=vorbis', 'audio/ogg; codecs=opus'], decoder: 'oga' },
  oga: { mime: 'audio/ogg', alternates: ['audio/ogg; codecs=vorbis'], decoder: 'oga' },
  opus: { mime: 'audio/ogg; codecs=opus', alternates: ['audio/opus', 'audio/ogg'], decoder: 'opus' },
  webm: { mime: 'audio/webm', alternates: ['audio/webm; codecs=opus', 'audio/webm; codecs=vorbis'], decoder: 'webm' },
  weba: { mime: 'audio/webm', alternates: ['audio/webm; codecs=opus'], decoder: 'webm' },
  flac: { mime: 'audio/flac', alternates: ['audio/x-flac'], decoder: 'flac' },
  amr: { mime: 'audio/amr', decoder: 'amr' },
  awb: { mime: 'audio/amr-wb', decoder: 'amr' },
  '3gp': { mime: 'audio/3gpp', alternates: ['video/3gpp'], decoder: 'm4a' },
  '3gpp': { mime: 'audio/3gpp', decoder: 'm4a' },
  '3g2': { mime: 'audio/3gpp2', alternates: ['video/3gpp2'], decoder: 'm4a' },
  wma: { mime: 'audio/x-ms-wma', decoder: 'wma' },
  asf: { mime: 'audio/x-ms-wma', decoder: 'wma' },
  aiff: { mime: 'audio/aiff', alternates: ['audio/x-aiff'], decoder: 'aiff' },
  aif: { mime: 'audio/aiff', alternates: ['audio/x-aiff'], decoder: 'aiff' },
  aifc: { mime: 'audio/aiff', decoder: 'aiff' },
  caf: { mime: 'audio/x-caf', decoder: 'caf' },
  mkv: { mime: 'audio/x-matroska', alternates: ['video/x-matroska'], decoder: 'mkv' },
  mka: { mime: 'audio/x-matroska', decoder: 'mkv' },
  avi: { mime: 'video/x-msvideo', decoder: 'avi' },
  ac3: { mime: 'audio/ac3', decoder: 'ac3' },
  eac3: { mime: 'audio/eac3', decoder: 'eac3' },
  ec3: { mime: 'audio/eac3', decoder: 'eac3' },
  dts: { mime: 'audio/vnd.dts', decoder: 'dts' },
  gsm: { mime: 'audio/x-gsm', decoder: 'gsm' },
  ape: { mime: 'audio/x-ape', decoder: 'ape' },
  wv: { mime: 'audio/x-wavpack', decoder: 'wv' },
  tta: { mime: 'audio/x-tta', decoder: 'tta' },
  mpc: { mime: 'audio/x-musepack', decoder: 'mpc' },
  qoa: { mime: 'audio/qoa', decoder: 'qoa' },
  dsf: { mime: 'audio/x-dsd', decoder: 'dsf' },
  dff: { mime: 'audio/x-dsd', decoder: 'dff' },
  mod: { mime: 'audio/mod', decoder: 'mod' },
  xm: { mime: 'audio/xm', decoder: 'xm' },
  s3m: { mime: 'audio/s3m', decoder: 's3m' },
  it: { mime: 'audio/it', decoder: 'it' },
};

// Formats that desktop/mobile browsers generally cannot play directly inside <audio>
const NON_NATIVE_BROWSER_FORMATS = new Set([
  'amr',
  'awb',
  'wma',
  'asf',
  'aiff',
  'aif',
  'aifc',
  'caf',
  'ac3',
  'eac3',
  'ec3',
  'dts',
  'gsm',
  'ape',
  'wv',
  'tta',
  'mpc',
  'qoa',
  'dsf',
  'dff',
  'mod',
  'xm',
  's3m',
  'it',
  'mkv',
  'mka',
  'avi',
]);

const GENERIC_MIMES = new Set([
  '',
  'application/octet-stream',
  'binary/octet-stream',
  'application/unknown',
  'text/plain',
]);

function normalizeExtToken(raw?: string | null): string {
  if (!raw) return '';
  const cleaned = raw.trim().toLowerCase().replace(/^\./, '');
  if (cleaned === 'amr-nb' || cleaned === 'amrnb') return 'amr';
  if (cleaned === 'amr-wb' || cleaned === 'amrwb') return 'awb';
  if (cleaned === 'audio/mpeg' || cleaned === 'mpeg') return 'mp3';
  if (cleaned === 'vorbis') return 'oga';
  if (cleaned === 'matroska') return 'mkv';
  return cleaned;
}

export function extractAudioExtension(url?: string, formatHint?: string): string {
  if (url) {
    try {
      const cleanPath = url.split('?')[0].split('#')[0];
      const dotIdx = cleanPath.lastIndexOf('.');
      const slashIdx = cleanPath.lastIndexOf('/');
      if (dotIdx > slashIdx && dotIdx < cleanPath.length - 1) {
        const ext = normalizeExtToken(cleanPath.slice(dotIdx + 1));
        if (ext && ext.length <= 8) return ext;
      }
    } catch {
      // ignore URL parsing errors
    }
  }
  return normalizeExtToken(formatHint);
}

function skipId3v2(buf: Uint8Array): number {
  if (buf.length < 10) return 0;
  if (buf[0] !== 0x49 || buf[1] !== 0x44 || buf[2] !== 0x33) return 0;
  const size =
    ((buf[6] & 0x7f) << 21) | ((buf[7] & 0x7f) << 14) | ((buf[8] & 0x7f) << 7) | (buf[9] & 0x7f);
  const footer = buf[5] & 0x10 ? 10 : 0;
  return 10 + size + footer;
}

export function sniffAudioSignature(buf: Uint8Array): string | undefined {
  if (!buf || buf.length < 4) return undefined;

  // '#!AMR-WB\n' vs '#!AMR\n'
  if (buf.length >= 6 && buf[0] === 0x23 && buf[1] === 0x21 && buf[2] === 0x41 && buf[3] === 0x4d && buf[4] === 0x52) {
    if (buf.length >= 9 && buf[5] === 0x2d && buf[6] === 0x57 && buf[7] === 0x42 && buf[8] === 0x0a) {
      return 'awb';
    }
    if (buf[5] === 0x0a) {
      return 'amr';
    }
  }

  // RIFF WAVE / AVI
  if (buf.length >= 12 && buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46) {
    if (buf[8] === 0x57 && buf[9] === 0x41 && buf[10] === 0x56 && buf[11] === 0x45) return 'wav';
    if (buf[8] === 0x41 && buf[9] === 0x56 && buf[10] === 0x49 && buf[11] === 0x20) return 'avi';
  }

  // FORM AIFF / AIFC
  if (
    buf.length >= 12 &&
    buf[0] === 0x46 &&
    buf[1] === 0x4f &&
    buf[2] === 0x52 &&
    buf[3] === 0x4d &&
    buf[8] === 0x41 &&
    buf[9] === 0x49 &&
    buf[10] === 0x46 &&
    (buf[11] === 0x46 || buf[11] === 0x43)
  ) {
    return 'aiff';
  }

  // Ogg container (Opus / OggFLAC / Vorbis)
  if (buf[0] === 0x4f && buf[1] === 0x67 && buf[2] === 0x67 && buf[3] === 0x53) {
    if (
      buf.length >= 36 &&
      buf[28] === 0x4f &&
      buf[29] === 0x70 &&
      buf[30] === 0x75 &&
      buf[31] === 0x73 &&
      buf[32] === 0x48 &&
      buf[33] === 0x65 &&
      buf[34] === 0x61 &&
      buf[35] === 0x64
    ) {
      return 'opus';
    }
    if (
      buf.length >= 33 &&
      buf[28] === 0x7f &&
      buf[29] === 0x46 &&
      buf[30] === 0x4c &&
      buf[31] === 0x41 &&
      buf[32] === 0x43
    ) {
      return 'flac';
    }
    return 'oga';
  }

  // FLAC
  if (buf[0] === 0x66 && buf[1] === 0x4c && buf[2] === 0x61 && buf[3] === 0x43) return 'flac';

  // ISO BMFF (MP4 / M4A / 3GP / 3G2 / MOV)
  if (buf.length >= 12 && buf[4] === 0x66 && buf[5] === 0x74 && buf[6] === 0x79 && buf[7] === 0x70) {
    const brand = String.fromCharCode(buf[8], buf[9], buf[10], buf[11]).toLowerCase();
    if (brand.startsWith('3gp')) return '3gp';
    if (brand.startsWith('3g2')) return '3g2';
    if (brand.startsWith('qt')) return 'mov';
    return 'm4a';
  }

  // EBML (Matroska / WebM)
  if (buf[0] === 0x1a && buf[1] === 0x45 && buf[2] === 0xdf && buf[3] === 0xa3) {
    const n = Math.min(buf.length, 64);
    for (let i = 4; i < n - 8; i++) {
      if (buf[i] === 0x42 && buf[i + 1] === 0x82) {
        if (buf[i + 3] === 0x6d && buf[i + 4] === 0x61 && buf[i + 5] === 0x74 && buf[i + 6] === 0x72) {
          return 'mkv';
        }
      }
    }
    return 'webm';
  }

  // ASF / WMA
  if (
    buf.length >= 8 &&
    buf[0] === 0x30 &&
    buf[1] === 0x26 &&
    buf[2] === 0xb2 &&
    buf[3] === 0x75 &&
    buf[4] === 0x8e &&
    buf[5] === 0x66 &&
    buf[6] === 0xcf &&
    buf[7] === 0x11
  ) {
    return 'wma';
  }

  // CAF
  if (buf[0] === 0x63 && buf[1] === 0x61 && buf[2] === 0x66 && buf[3] === 0x66) return 'caf';

  // QOA
  if (buf[0] === 0x71 && buf[1] === 0x6f && buf[2] === 0x61 && buf[3] === 0x66) return 'qoa';

  // WavPack / TTA / MPC / APE / DSD
  if (buf[0] === 0x77 && buf[1] === 0x76 && buf[2] === 0x70 && buf[3] === 0x6b) return 'wv';
  if (buf[0] === 0x54 && buf[1] === 0x54 && buf[2] === 0x41 && buf[3] === 0x31) return 'tta';
  if (buf[0] === 0x4d && buf[1] === 0x50 && buf[2] === 0x43 && buf[3] === 0x4b) return 'mpc';
  if (buf[0] === 0x4d && buf[1] === 0x50 && buf[2] === 0x2b && (buf[3] & 0x0f) === 7) return 'mpc';
  if (buf[0] === 0x4d && buf[1] === 0x41 && buf[2] === 0x43 && buf[3] === 0x20) return 'ape';
  if (buf[0] === 0x44 && buf[1] === 0x53 && buf[2] === 0x44 && buf[3] === 0x20) return 'dsf';
  if (
    buf.length >= 16 &&
    buf[0] === 0x46 &&
    buf[1] === 0x52 &&
    buf[2] === 0x4d &&
    buf[3] === 0x38 &&
    buf[12] === 0x44 &&
    buf[13] === 0x53 &&
    buf[14] === 0x44 &&
    buf[15] === 0x20
  ) {
    return 'dff';
  }

  // AC-3 / E-AC-3 / DTS
  if (buf.length >= 6 && buf[0] === 0x0b && buf[1] === 0x77) {
    const bsid = buf[5] >> 3;
    return bsid >= 11 && bsid <= 16 ? 'eac3' : 'ac3';
  }
  if (
    (buf[0] === 0x7f && buf[1] === 0xfe && buf[2] === 0x80 && buf[3] === 0x01) ||
    (buf[0] === 0xfe && buf[1] === 0x7f && buf[2] === 0x01 && buf[3] === 0x80) ||
    (buf[0] === 0x1f && buf[1] === 0xff && buf[2] === 0xe8 && buf[3] === 0x00)
  ) {
    return 'dts';
  }

  // MPEG sync / AAC ADTS / ID3v2
  if (buf[0] === 0xff && (buf[1] & 0xe0) === 0xe0 && (buf[1] & 0x06) !== 0x00) return 'mp3';
  if (buf[0] === 0xff && (buf[1] & 0xf0) === 0xf0 && (buf[1] & 0x06) === 0x00) return 'aac';
  if (buf[0] === 0x41 && buf[1] === 0x44 && buf[2] === 0x49 && buf[3] === 0x46) return 'aac'; // ADIF

  const id3End = skipId3v2(buf);
  if (id3End > 0) {
    if (id3End >= buf.length) return 'mp3';
    const rest = buf.subarray(id3End);
    if (rest.length >= 4) {
      if (rest[0] === 0x66 && rest[1] === 0x4c && rest[2] === 0x61 && rest[3] === 0x43) return 'flac';
      if (rest[0] === 0x54 && rest[1] === 0x54 && rest[2] === 0x41 && rest[3] === 0x31) return 'tta';
      if (rest[0] === 0xff && (rest[1] & 0xf0) === 0xf0 && (rest[1] & 0x06) === 0x00) return 'aac';
    }
    return 'mp3';
  }

  return undefined;
}

export function resolveAudioMimeType(opts: {
  url?: string;
  formatHint?: string;
  serverContentType?: string | null;
  magicBytes?: Uint8Array;
}): string {
  if (opts.magicBytes) {
    const sniffed = sniffAudioSignature(opts.magicBytes);
    if (sniffed && FORMAT_MIME_MAP[sniffed]) {
      return FORMAT_MIME_MAP[sniffed].mime;
    }
  }

  const ext = extractAudioExtension(opts.url, opts.formatHint);
  if (ext && FORMAT_MIME_MAP[ext]) {
    return FORMAT_MIME_MAP[ext].mime;
  }

  const rawCt = (opts.serverContentType || '').split(';')[0].trim().toLowerCase();
  if (!GENERIC_MIMES.has(rawCt)) {
    if (rawCt === 'audio/mp3') return 'audio/mpeg';
    if (rawCt === 'audio/x-wav') return 'audio/wav';
    if (rawCt === 'audio/x-m4a') return 'audio/mp4';
    if (rawCt.startsWith('audio/') || rawCt.startsWith('video/')) {
      return opts.serverContentType!.trim();
    }
  }

  return 'audio/mpeg';
}

export function shouldTranscodeDirectly(audioEl: HTMLAudioElement, ext: string, mimeType: string): boolean {
  const normExt = normalizeExtToken(ext);
  if (NON_NATIVE_BROWSER_FORMATS.has(normExt)) {
    return true;
  }

  const mimeLower = mimeType.split(';')[0].trim().toLowerCase();
  if (
    mimeLower === 'audio/amr' ||
    mimeLower === 'audio/amr-wb' ||
    mimeLower === 'audio/x-ms-wma' ||
    mimeLower === 'audio/aiff' ||
    mimeLower === 'audio/x-aiff' ||
    mimeLower === 'audio/x-caf'
  ) {
    return true;
  }

  const entry = FORMAT_MIME_MAP[normExt];
  const candidates = [mimeType, ...(entry?.alternates || [])].filter(Boolean);
  for (const candidate of candidates) {
    try {
      const support = audioEl.canPlayType(candidate);
      if (support === 'probably' || support === 'maybe') {
        return false;
      }
    } catch {
      // ignore invalid MIME strings
    }
  }

  // If browser explicitly says "" for the detected MIME type, decode client-side
  if (normExt && entry) {
    return true;
  }

  return false;
}

function encodeAudioDataToWavBlob(audioData: AudioData): { wavBlob: Blob; durationSeconds: number; sampleRate: number } {
  const { channelData, sampleRate } = audioData;
  if (!channelData.length || !channelData[0]?.length || !sampleRate) {
    throw new Error('Decoded audio stream is empty.');
  }

  let channels = channelData;
  let targetRate = sampleRate;
  const origFrames = channels[0].length;
  const durationSeconds = origFrames / sampleRate;

  // Memory safety guard for long high-sample-rate files on mobile devices (cap WAV payload <= ~180 MB)
  const MAX_WAV_BYTES = 180 * 1024 * 1024;
  if (origFrames * channels.length * 2 > MAX_WAV_BYTES && channels.length > 1) {
    const mono = new Float32Array(origFrames);
    const inv = 1 / channels.length;
    for (let i = 0; i < origFrames; i++) {
      let sum = 0;
      for (let c = 0; c < channels.length; c++) {
        sum += channels[c][i];
      }
      mono[i] = sum * inv;
    }
    channels = [mono];
  }

  let stride = 1;
  while (Math.floor(channels[0].length / stride) * channels.length * 2 > MAX_WAV_BYTES) {
    stride += 1;
  }
  if (stride > 1) {
    targetRate = Math.max(8000, Math.round(sampleRate / stride));
  }

  const numChannels = channels.length;
  const numFrames = Math.floor(channels[0].length / stride);
  const dataByteLength = numFrames * numChannels * 2;
  const buffer = new ArrayBuffer(44 + dataByteLength);
  const view = new DataView(buffer);

  const writeAscii = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  };

  writeAscii(0, 'RIFF');
  view.setUint32(4, 36 + dataByteLength, true);
  writeAscii(8, 'WAVE');
  writeAscii(12, 'fmt ');
  view.setUint32(16, 16, true); // PCM chunk size
  view.setUint16(20, 1, true); // PCM format
  view.setUint16(22, numChannels, true);
  view.setUint32(24, targetRate, true);
  view.setUint32(28, targetRate * numChannels * 2, true);
  view.setUint16(32, numChannels * 2, true);
  view.setUint16(34, 16, true); // 16-bit PCM
  writeAscii(36, 'data');
  view.setUint32(40, dataByteLength, true);

  let byteOffset = 44;
  for (let i = 0; i < numFrames; i++) {
    const srcIdx = i * stride;
    for (let c = 0; c < numChannels; c++) {
      let sample = channels[c][srcIdx];
      if (sample > 1) sample = 1;
      else if (sample < -1) sample = -1;
      view.setInt16(byteOffset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
      byteOffset += 2;
    }
  }

  return {
    wavBlob: new Blob([buffer], { type: 'audio/wav' }),
    durationSeconds,
    sampleRate: targetRate,
  };
}

async function decodeWithWebAudioApi(bytes: Uint8Array): Promise<AudioData> {
  const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioCtx) {
    throw new Error('Web Audio API is unavailable in this browser.');
  }
  const ctx = new AudioCtx();
  try {
    const copy = bytes.slice().buffer;
    const audioBuffer = await ctx.decodeAudioData(copy);
    const channelData: Float32Array[] = [];
    for (let ch = 0; ch < audioBuffer.numberOfChannels; ch++) {
      channelData.push(audioBuffer.getChannelData(ch).slice());
    }
    return { channelData, sampleRate: audioBuffer.sampleRate };
  } finally {
    await ctx.close().catch(() => {});
  }
}

export async function decodeAudioToWavBlob(
  bytes: Uint8Array,
  extHint?: string,
  mimeHint?: string
): Promise<{ wavBlob: Blob; durationSeconds: number; sampleRate: number; detectedFormat: string }> {
  const sniffed = sniffAudioSignature(bytes);
  const ext = normalizeExtToken(extHint);
  const resolvedExt = sniffed || ext || normalizeExtToken(mimeHint?.split('/')[1]?.split(';')[0]);

  const { default: decode } = await import('@audio/decode');
  let audioData: AudioData | null = null;
  let lastError: unknown = null;

  // 1. Auto-detect magic bytes via @audio/decode (handles AMR-NB, AMR-WB, MP3, MP4/M4A/3GP, WMA, FLAC, Opus, Ogg, WebM, WAV, AIFF, CAF, AC3, DTS, etc.)
  try {
    audioData = await decode(bytes);
  } catch (err) {
    lastError = err;
  }

  // 2. If magic bytes weren't recognized (e.g. headerless GSM or extension-hinted format), invoke codec decoder explicitly
  if ((!audioData || !audioData.channelData.length) && resolvedExt) {
    const codecName = FORMAT_MIME_MAP[resolvedExt]?.decoder || resolvedExt;
    const decoderFactory = (decode as unknown as Record<string, (() => Promise<(chunk?: Uint8Array) => Promise<AudioData>>) | undefined>)[
      codecName
    ];
    if (typeof decoderFactory === 'function') {
      const dec = await decoderFactory();
      try {
        const first = await dec(bytes);
        const tail = await dec();
        if (first.channelData.length && tail.channelData.length) {
          const merged = first.channelData.map((ch, idx) => {
            const extra = tail.channelData[idx % tail.channelData.length];
            const out = new Float32Array(ch.length + extra.length);
            out.set(ch);
            out.set(extra, ch.length);
            return out;
          });
          audioData = { channelData: merged, sampleRate: first.sampleRate || tail.sampleRate };
        } else {
          audioData = first.channelData.length ? first : tail;
        }
      } catch (err) {
        lastError = err;
      }
    }
  }

  // 3. Fallback to browser's native Web Audio API decodeAudioData if WASM decode did not succeed
  if (!audioData || !audioData.channelData.length || !audioData.channelData[0]?.length) {
    try {
      audioData = await decodeWithWebAudioApi(bytes);
    } catch (webAudioErr) {
      throw lastError instanceof Error ? lastError : webAudioErr instanceof Error ? webAudioErr : new Error('Unsupported audio format.');
    }
  }

  const encoded = encodeAudioDataToWavBlob(audioData);
  return {
    ...encoded,
    detectedFormat: resolvedExt || 'audio',
  };
}

// Small in-memory session cache for transcoded WAV blobs so re-playing or switching back is instant
const DECODED_CACHE_LIMIT = 4;
const decodedSessionCache = new Map<string, { wavBlob: Blob; durationSeconds: number }>();

export function getCachedDecodedAudio(mediaUrl: string): { wavBlob: Blob; durationSeconds: number } | undefined {
  const hit = decodedSessionCache.get(mediaUrl);
  if (!hit) return undefined;
  // Refresh LRU order
  decodedSessionCache.delete(mediaUrl);
  decodedSessionCache.set(mediaUrl, hit);
  return hit;
}

export function setCachedDecodedAudio(mediaUrl: string, value: { wavBlob: Blob; durationSeconds: number }): void {
  if (decodedSessionCache.has(mediaUrl)) {
    decodedSessionCache.delete(mediaUrl);
  } else if (decodedSessionCache.size >= DECODED_CACHE_LIMIT) {
    const oldestKey = decodedSessionCache.keys().next().value;
    if (oldestKey !== undefined) {
      decodedSessionCache.delete(oldestKey);
    }
  }
  decodedSessionCache.set(mediaUrl, value);
}
