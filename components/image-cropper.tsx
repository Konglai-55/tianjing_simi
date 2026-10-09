"use client";

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { getCropRect, type CropSettings } from "@/lib/image-client";

const DEFAULT_CROP: CropSettings = { zoom: 1, x: 0.5, y: 0.5 };

export function ImageCropper({
  file,
  initialCrop,
  onCancel,
  onConfirm,
}: {
  file: File;
  initialCrop?: CropSettings;
  onCancel: () => void;
  onConfirm: (crop: CropSettings, preview: Blob) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const bitmapRef = useRef<ImageBitmap | null>(null);
  const dragRef = useRef<{
    pointerId: number;
    clientX: number;
    clientY: number;
    crop: CropSettings;
  } | null>(null);
  const [crop, setCrop] = useState<CropSettings>(initialCrop || DEFAULT_CROP);
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 });
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    document.body.style.overflow = "hidden";
    createImageBitmap(file, { imageOrientation: "from-image" })
      .then((bitmap) => {
        if (cancelled) return bitmap.close();
        bitmapRef.current = bitmap;
        setImageSize({ width: bitmap.width, height: bitmap.height });
      })
      .catch(() => setError("这张图片无法在浏览器中裁剪"));

    return () => {
      cancelled = true;
      bitmapRef.current?.close();
      bitmapRef.current = null;
      document.body.style.overflow = "";
    };
  }, [file]);

  useEffect(() => {
    const bitmap = bitmapRef.current;
    const canvas = canvasRef.current;
    if (!bitmap || !canvas || imageSize.width === 0) return;
    const context = canvas.getContext("2d", { alpha: false });
    if (!context) return;
    const source = getCropRect(bitmap.width, bitmap.height, crop);
    context.fillStyle = "#e9e6df";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(
      bitmap,
      source.x,
      source.y,
      source.width,
      source.height,
      0,
      0,
      canvas.width,
      canvas.height,
    );
  }, [crop, imageSize]);

  function startDrag(event: ReactPointerEvent<HTMLCanvasElement>) {
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      pointerId: event.pointerId,
      clientX: event.clientX,
      clientY: event.clientY,
      crop,
    };
  }

  function drag(event: ReactPointerEvent<HTMLCanvasElement>) {
    const start = dragRef.current;
    const canvas = canvasRef.current;
    if (!start || start.pointerId !== event.pointerId || !canvas) return;
    const bounds = canvas.getBoundingClientRect();
    const source = getCropRect(imageSize.width, imageSize.height, start.crop);
    const availableX = imageSize.width - source.width;
    const availableY = imageSize.height - source.height;
    const sourceDeltaX = ((event.clientX - start.clientX) / bounds.width) * source.width;
    const sourceDeltaY = ((event.clientY - start.clientY) / bounds.height) * source.height;
    setCrop({
      ...start.crop,
      x: availableX > 0
        ? clamp(start.crop.x - sourceDeltaX / availableX)
        : 0.5,
      y: availableY > 0
        ? clamp(start.crop.y - sourceDeltaY / availableY)
        : 0.5,
    });
  }

  function endDrag(event: ReactPointerEvent<HTMLCanvasElement>) {
    if (dragRef.current?.pointerId === event.pointerId) dragRef.current = null;
  }

  function confirm() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.toBlob((blob) => {
      if (!blob) return setError("裁剪预览生成失败");
      onConfirm(crop, blob);
    }, "image/webp", 0.86);
  }

  return (
    <div className="cropper-layer" role="dialog" aria-modal="true" aria-label="裁剪图片">
      <button className="cropper-backdrop" type="button" onClick={onCancel} aria-label="取消裁剪" />
      <section className="cropper-dialog">
        <div className="cropper-head">
          <div><strong>裁剪封面</strong><span>仅影响封面，详情页仍展示完整原图</span></div>
          <button type="button" onClick={onCancel}>取消</button>
        </div>
        <div className="cropper-stage">
          <canvas
            ref={canvasRef}
            width={600}
            height={800}
            onPointerDown={startDrag}
            onPointerMove={drag}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
          />
          <span>拖动图片调整位置</span>
        </div>
        <label className="cropper-zoom">
          <span>缩放</span>
          <input
            type="range"
            min="1"
            max="3"
            step="0.01"
            value={crop.zoom}
            onChange={(event) => setCrop((current) => ({
              ...current,
              zoom: Number(event.target.value),
            }))}
          />
          <b>{crop.zoom.toFixed(1)}×</b>
        </label>
        {error && <div className="form-error">{error}</div>}
        <div className="cropper-actions">
          <button type="button" onClick={() => setCrop(DEFAULT_CROP)}>重置</button>
          <button type="button" disabled={imageSize.width === 0} onClick={confirm}>使用此裁剪</button>
        </div>
      </section>
    </div>
  );
}

function clamp(value: number) {
  return Math.min(1, Math.max(0, value));
}
