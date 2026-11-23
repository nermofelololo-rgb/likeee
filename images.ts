function drawCover(source: CanvasImageSource, sw: number, sh: number, maxEdge: number, maxChars: number) {
  const scale = Math.min(1, maxEdge / Math.max(sw, sh));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(sw * scale));
  canvas.height = Math.max(1, Math.round(sh * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("المتصفح مش قادر يجهز الصورة");
  ctx.fillStyle = "#f3efe6";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
  let quality = 0.72;
  let url = canvas.toDataURL("image/jpeg", quality);
  while (url.length > maxChars && quality > 0.42) {
    quality -= 0.08;
    url = canvas.toDataURL("image/jpeg", quality);
  }
  if (url.length > maxChars) throw new Error("الصورة كبيرة حتى بعد التصغير");
  return url;
}

export async function compressFile(file: File, maxEdge: number, maxChars: number): Promise<string> {
  if (!file.type.startsWith("image/")) throw new Error("الملف مش صورة");
  if (file.size > 12_000_000) throw new Error("الصورة أكبر من ١٢ ميجا");
  const bitmap = await createImageBitmap(file);
  try {
    return drawCover(bitmap, bitmap.width, bitmap.height, maxEdge, maxChars);
  } finally {
    bitmap.close();
  }
}

export async function shrinkDataUrl(dataUrl: string, maxEdge: number, maxChars: number): Promise<string> {
  if (dataUrl.length <= maxChars && dataUrl.startsWith("data:image/jpeg")) return dataUrl;
  const img = new Image();
  img.src = dataUrl;
  await img.decode();
  return drawCover(img, img.naturalWidth, img.naturalHeight, maxEdge, maxChars);
}
