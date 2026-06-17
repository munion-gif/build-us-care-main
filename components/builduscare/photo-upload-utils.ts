const PHOTO_MAX_DIMENSION = 1600;
const PHOTO_JPEG_QUALITY = 0.78;
const PHOTO_SKIP_BYTES = 900 * 1024;

function imageCanBeOptimized(file: File) {
  return /^image\/(jpeg|jpg|png|webp)$/i.test(file.type) && file.size > PHOTO_SKIP_BYTES;
}

function loadImage(url: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = url;
  });
}

function canvasToBlob(canvas: HTMLCanvasElement) {
  return new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, "image/jpeg", PHOTO_JPEG_QUALITY);
  });
}

export async function optimizePhotoFile(file: File) {
  if (!(file instanceof File) || typeof document === "undefined" || !imageCanBeOptimized(file)) return file;

  const url = URL.createObjectURL(file);
  try {
    const image = await loadImage(url);
    const naturalWidth = image.naturalWidth || image.width;
    const naturalHeight = image.naturalHeight || image.height;
    const maxSide = Math.max(naturalWidth, naturalHeight);
    const scale = Math.min(1, PHOTO_MAX_DIMENSION / Math.max(1, maxSide));
    const width = Math.max(1, Math.round(naturalWidth * scale));
    const height = Math.max(1, Math.round(naturalHeight * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d", { alpha: false });
    if (!context) return file;

    context.drawImage(image, 0, 0, width, height);
    const blob = await canvasToBlob(canvas);
    if (!blob || blob.size >= file.size) return file;

    const baseName = (file.name || "photo").replace(/\.[^.]+$/, "");
    return new File([blob], `${baseName}.jpg`, {
      type: "image/jpeg",
      lastModified: file.lastModified || Date.now()
    });
  } catch {
    return file;
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function appendOptimizedPhotos(formData: FormData, files: File[], fieldName = "photos") {
  for (const [index, file] of files.entries()) {
    const optimized = await optimizePhotoFile(file);
    formData.append(fieldName, optimized, optimized.name || file.name || `photo-${index + 1}.jpg`);
  }
}
