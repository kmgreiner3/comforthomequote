// Client-side photo downscale before upload: Vertex reads images fine at
// ~1.5k px on the long edge, and shrinking in the browser keeps uploads
// fast on phone connections and well under the API's size ceiling.

export const MAX_DIMENSION = 1568;
const JPEG_QUALITY = 0.85;

// Decodes `file`, scales the long edge down to MAX_DIMENSION (never up),
// and re-encodes as JPEG. Separate module so tests can mock it: jsdom has
// no canvas or image decoder.
export async function downscaleToJpeg(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  try {
    const scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('canvas-unavailable');
    ctx.drawImage(bitmap, 0, 0, width, height);

    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error('encode-failed'))),
        'image/jpeg',
        JPEG_QUALITY,
      );
    });
  } finally {
    bitmap.close();
  }
}
