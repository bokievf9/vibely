import imageCompression from 'browser-image-compression'

export type PreparedImage = { file: File; width: number; height: number }

// Client-side: shrink before upload and measure, so width/height can be stored (no CLS).
export async function prepareImage(source: File): Promise<PreparedImage> {
  const file = await imageCompression(source, {
    maxSizeMB: 1,
    maxWidthOrHeight: 1440,
    fileType: 'image/webp',
    // Main thread: the worker mode loads its own copy from a CDN, which the CSP doesn't allow.
    useWebWorker: false,
  })
  const bitmap = await createImageBitmap(file)
  const { width, height } = bitmap
  bitmap.close()
  return { file, width, height }
}
