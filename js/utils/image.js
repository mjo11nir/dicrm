// Работа с изображениями: уменьшение фото с телефона перед сохранением.

/** Загрузить файл-картинку в <img> */
function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Не удалось открыть изображение')); };
    img.src = url;
  });
}

/**
 * Уменьшить изображение так, чтобы большая сторона была не больше max.
 * @param {File} file
 * @param {{max?: number, square?: boolean, quality?: number}} o — square: обрезать до квадрата (для аватарок)
 * @returns {Promise<string>} data URL (JPEG)
 */
export async function resizeImage(file, { max = 1600, square = false, quality = 0.85 } = {}) {
  const img = await loadImage(file);
  let sx = 0;
  let sy = 0;
  let sw = img.naturalWidth;
  let sh = img.naturalHeight;
  if (square) {
    const side = Math.min(sw, sh);
    sx = (sw - side) / 2;
    sy = (sh - side) / 2;
    sw = sh = side;
  }
  const scale = Math.min(1, max / Math.max(sw, sh));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(sw * scale);
  canvas.height = Math.round(sh * scale);
  canvas.getContext('2d').drawImage(img, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/jpeg', quality);
}

/** Открыть системный выбор фото. Возвращает File или null. */
export function pickImageFile() {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.addEventListener('change', () => resolve(input.files?.[0] || null));
    input.click();
  });
}
