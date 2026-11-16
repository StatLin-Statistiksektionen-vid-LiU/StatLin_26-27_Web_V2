import type { ImageRef } from "@/lib/types";

/** HEIC och liknande har ofta ingen filtyp i webbläsaren. */
export const isImageFile = (file: File) => file.type.startsWith("image/") || /\.(heic|heif|avif)$/i.test(file.name);

export type UploadResult = { id: number; image?: ImageRef; caption?: string; error?: string };

/** Laddar upp en fil till /api/admin/upload med förloppsrapportering (XHR, eftersom fetch saknar upload-progress). */
export function uploadFile(
  file: File,
  fields: Record<string, string>,
  onProgress?: (fraction: number) => void,
): Promise<UploadResult> {
  return new Promise((resolve, reject) => {
    const fd = new FormData();
    fd.append("file", file);
    for (const [k, v] of Object.entries(fields)) fd.append(k, v);
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/admin/upload");
    xhr.responseType = "json";
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress?.(e.loaded / e.total);
    xhr.onload = () => {
      const body = (xhr.response ?? {}) as UploadResult;
      if (xhr.status >= 200 && xhr.status < 300) resolve(body);
      else reject(new Error(body.error ?? `Uppladdningen misslyckades (${xhr.status}).`));
    };
    xhr.onerror = () => reject(new Error("Nätverksfel vid uppladdning."));
    xhr.send(fd);
  });
}
