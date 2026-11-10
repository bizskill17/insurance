import { getStoredAuthUser } from "./auth";

// Keep in step with DOCUMENT_UPLOAD_ALLOWED_EXTENSIONS / DOCUMENT_UPLOAD_MAX_BYTES in api/public/index.php.
export const DOCUMENT_ALLOWED_EXTENSIONS = ["pdf", "jpg", "jpeg", "png", "webp", "heic", "heif", "doc", "docx", "xls", "xlsx"];
export const DOCUMENT_MAX_BYTES = 15 * 1024 * 1024;
export const DOCUMENT_ACCEPT = DOCUMENT_ALLOWED_EXTENSIONS.map((extension) => `.${extension}`).join(",");

// Photos larger than this are shrunk before upload. Scans stay readable at this size.
const COMPRESS_ABOVE_BYTES = 600 * 1024;
const MAX_IMAGE_EDGE = 2000;
const JPEG_QUALITY = 0.82;
const COMPRESSIBLE_TYPES = ["image/jpeg", "image/png", "image/webp"];

function fileExtension(name) {
  const parts = String(name || "").toLowerCase().split(".");
  return parts.length > 1 ? parts.pop() : "";
}

export function formatFileSize(bytes) {
  if (!Number.isFinite(bytes)) return "";
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/** Returns an error message for a file that cannot be uploaded, or "" when it is fine. */
export function validateDocumentFile(file) {
  if (!file) return "Please choose a file.";
  if (!DOCUMENT_ALLOWED_EXTENSIONS.includes(fileExtension(file.name))) {
    return `"${file.name}" is not an allowed file type. Allowed: ${DOCUMENT_ALLOWED_EXTENSIONS.join(", ")}.`;
  }
  if (file.size > DOCUMENT_MAX_BYTES) {
    return `"${file.name}" is ${formatFileSize(file.size)}. The limit is ${formatFileSize(DOCUMENT_MAX_BYTES)}.`;
  }
  return "";
}

async function loadImage(file) {
  if (typeof createImageBitmap === "function") {
    return createImageBitmap(file);
  }

  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not read image."));
    };
    image.src = url;
  });
}

/**
 * Shrinks large photos (phone camera pictures are often 3–8 MB) to a readable JPEG.
 * PDFs, Office files and small images are returned unchanged, as is any image
 * that would not get smaller.
 */
export async function compressDocumentFile(file) {
  if (!file || !COMPRESSIBLE_TYPES.includes(file.type) || file.size <= COMPRESS_ABOVE_BYTES) {
    return file;
  }

  try {
    const image = await loadImage(file);
    const width = image.width;
    const height = image.height;
    const scale = Math.min(1, MAX_IMAGE_EDGE / Math.max(width, height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(width * scale);
    canvas.height = Math.round(height * scale);

    const context = canvas.getContext("2d");
    // JPEG has no transparency, so paint a white page behind PNG scans.
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    if (typeof image.close === "function") image.close();

    const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY));
    if (!blob || blob.size >= file.size) {
      return file;
    }

    const baseName = String(file.name).replace(/\.[^.]+$/, "") || "document";
    return new File([blob], `${baseName}.jpg`, { type: "image/jpeg", lastModified: Date.now() });
  } catch {
    return file;
  }
}

/**
 * Sends form data and reports upload progress (0–100) while the file travels.
 * Uses XMLHttpRequest because fetch cannot report upload progress.
 * Resolves to { ok, status, json }.
 */
export function postFormWithProgress(url, formData, onProgress) {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open("POST", url);

    const organizationId = getStoredAuthUser()?.organization_id;
    if (organizationId) {
      request.setRequestHeader("X-Organization-Id", String(organizationId));
    }

    request.upload.onprogress = (event) => {
      if (event.lengthComputable && typeof onProgress === "function") {
        onProgress(Math.min(100, Math.round((event.loaded / event.total) * 100)));
      }
    };

    request.onload = () => {
      const rawText = request.responseText || "";
      let json = null;
      try {
        json = rawText.trim() ? JSON.parse(rawText) : null;
      } catch {
        json = null;
      }

      if (!json) {
        const message =
          request.status === 413
            ? "The files are too large for the server. Please upload fewer or smaller files."
            : `Server returned an unreadable response (${request.status}).`;
        resolve({ ok: false, status: request.status, json: { message } });
        return;
      }

      resolve({ ok: request.status >= 200 && request.status < 300, status: request.status, json });
    };

    request.onerror = () => reject(new Error("Network error while uploading. Please check your connection and try again."));
    request.ontimeout = () => reject(new Error("Upload timed out. Please try again."));
    request.send(formData);
  });
}
