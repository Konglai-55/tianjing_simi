export type PreparedImage = {
  full: Blob;
  fullFileName: string;
  thumb: Blob;
  width: number;
  height: number;
};

export type CropSettings = {
  zoom: number;
  x: number;
  y: number;
};

export function getCropRect(
  width: number,
  height: number,
  crop: CropSettings,
) {
  const targetRatio = 3 / 4;
  const sourceRatio = width / height;
  const baseWidth = sourceRatio > targetRatio ? height * targetRatio : width;
  const baseHeight = sourceRatio > targetRatio ? height : width / targetRatio;
  const zoom = Math.min(3, Math.max(1, crop.zoom));
  const cropWidth = baseWidth / zoom;
  const cropHeight = baseHeight / zoom;
  const availableX = Math.max(0, width - cropWidth);
  const availableY = Math.max(0, height - cropHeight);

  return {
    x: availableX * Math.min(1, Math.max(0, crop.x)),
    y: availableY * Math.min(1, Math.max(0, crop.y)),
    width: cropWidth,
    height: cropHeight,
  };
}

async function resize(
  source: ImageBitmap,
  maxSide: number,
  quality: number,
  crop?: CropSettings,
) {
  const sourceRect = crop
    ? getCropRect(source.width, source.height, crop)
    : { x: 0, y: 0, width: source.width, height: source.height };
  const scale = Math.min(1, maxSide / Math.max(sourceRect.width, sourceRect.height));
  const width = Math.max(1, Math.round(sourceRect.width * scale));
  const height = Math.max(1, Math.round(sourceRect.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d", { alpha: false });
  if (!context) throw new Error("浏览器无法处理图片");
  context.drawImage(
    source,
    sourceRect.x,
    sourceRect.y,
    sourceRect.width,
    sourceRect.height,
    0,
    0,
    width,
    height,
  );

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/webp", quality),
  );
  if (!blob) throw new Error("图片压缩失败");
  return { blob, width, height };
}

export async function prepareImage(
  file: File,
  crop?: CropSettings,
): Promise<PreparedImage> {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  try {
    const canKeepOriginal = new Set([
      "image/jpeg",
      "image/png",
      "image/webp",
    ]).has(file.type);
    const [convertedFull, thumb] = await Promise.all([
      canKeepOriginal ? Promise.resolve(null) : resize(bitmap, 3200, 0.92),
      resize(bitmap, 720, 0.8, crop),
    ]);
    return {
      full: convertedFull?.blob || file,
      fullFileName: convertedFull ? `${file.name}.webp` : file.name,
      thumb: thumb.blob,
      width: convertedFull?.width || bitmap.width,
      height: convertedFull?.height || bitmap.height,
    };
  } finally {
    bitmap.close();
  }
}
