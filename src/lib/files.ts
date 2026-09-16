import * as FileSystem from 'expo-file-system';

/**
 * Read a local file (a camera capture, a picked image) into bytes.
 *
 * `fetch(uri)` looks like it does this and does not: React Native resolves the
 * URI through its network stack, which on a local file hands back the string
 * "File not found" with a 200. That body then uploads cleanly as a 14-byte
 * "image". `File.arrayBuffer()` reads the file natively instead.
 */
export async function readLocalFile(uri: string): Promise<Uint8Array> {
  const file = new FileSystem.File(uri);
  const buffer = await file.arrayBuffer();
  return new Uint8Array(buffer);
}

export type ImageFormat = { extension: 'png' | 'jpg'; contentType: string };

/**
 * Identify an image by its magic bytes rather than its file extension — picked
 * images arrive as `content://…` or as a cache path with no extension at all,
 * and the bytes are the only thing that cannot lie.
 *
 * Only PNG and JPEG are recognised: they are the two formats pdf-lib can embed,
 * so anything else would upload fine and then vanish from the document.
 */
export function detectImageFormat(bytes: Uint8Array): ImageFormat | null {
  if (bytes.length < 4) return null;
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
    return { extension: 'png', contentType: 'image/png' };
  }
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return { extension: 'jpg', contentType: 'image/jpeg' };
  }
  return null;
}
