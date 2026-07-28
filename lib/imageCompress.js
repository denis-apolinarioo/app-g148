/* eslint-disable */
import imageCompression from 'browser-image-compression';

export async function compressImage(file) {
  if (!file) return null;
  if (file.size < 200 * 1024) return file; // Se for pequena, não mexe

  const options = {
    maxSizeMB: 1,
    maxWidthOrHeight: 1280,
    useWebWorker: true,
    initialQuality: 0.7
  };

  try {
    return await imageCompression(file, options);
  } catch (error) {
    try {
      // Segunda tentativa se a primeira falhar
      return await imageCompression(file, { ...options, useWebWorker: false });
    } catch (e) {
      return file; // Em último caso, manda a original
    }
  }
}
