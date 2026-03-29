/** Tamanho final do avatar (px) — mantém arquivo pequeno para API/localStorage. */
export const AVATAR_OUTPUT_PX = 72;
const JPEG_QUALITY = 0.68;

/**
 * Recorta o centro em quadrado (crop), redimensiona e aplica máscara circular.
 * @param {File} file
 * @returns {Promise<string>} data URL image/jpeg
 */
export function fileToSmallRoundAvatarDataUrl(file) {
  return new Promise((resolve, reject) => {
    if (!file?.type?.startsWith("image/")) {
      reject(new Error("Use uma imagem."));
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      reject(new Error("Imagem muito grande (máx. 8 MB)."));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        try {
          resolve(cropCenterSquareToCircleDataUrl(img, AVATAR_OUTPUT_PX, JPEG_QUALITY));
        } catch (e) {
          reject(e);
        }
      };
      img.onerror = () => reject(new Error("Não foi possível abrir a imagem."));
      img.src = reader.result;
    };
    reader.onerror = () => reject(new Error("Leitura do arquivo falhou."));
    reader.readAsDataURL(file);
  });
}

function cropCenterSquareToCircleDataUrl(img, size, quality) {
  const side = Math.min(img.naturalWidth || img.width, img.naturalHeight || img.height);
  if (side < 1) {
    throw new Error("Imagem inválida.");
  }
  const sx = ((img.naturalWidth || img.width) - side) / 2;
  const sy = ((img.naturalHeight || img.height) - side) / 2;

  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Canvas indisponível.");
  }

  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
  ctx.closePath();
  ctx.clip();

  ctx.drawImage(img, sx, sy, side, side, 0, 0, size, size);

  let dataUrl = canvas.toDataURL("image/jpeg", quality);

  if (dataUrl.length > 75_000) {
    dataUrl = canvas.toDataURL("image/jpeg", Math.max(0.5, quality - 0.12));
  }
  if (dataUrl.length > 120_000) {
    dataUrl = canvas.toDataURL("image/jpeg", Math.max(0.45, quality - 0.15));
  }

  return dataUrl;
}
