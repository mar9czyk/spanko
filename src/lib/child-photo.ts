import { pb } from "@/lib/pocketbase";
import type { ChildRecord } from "@/lib/types/database";

/** Dłuższy bok zdjęcia po zmniejszeniu w przeglądarce (oszczędza transfer i dysk serwera). */
export const CHILD_PHOTO_MAX_SIDE_PX = 512;

const CHILD_PHOTO_THUMB = "96x96";
const CHILD_PHOTO_JPEG_QUALITY = 0.85;

/**
 * Wylicza wymiary obrazu zmieszczonego w kwadracie `maxSide` z zachowaniem proporcji (bez powiększania).
 *
 * @param {number} width - Szerokość oryginału w pikselach
 * @param {number} height - Wysokość oryginału w pikselach
 * @param {number} maxSide - Maksymalna długość dłuższego boku
 * @returns {{ width: number; height: number }} Wymiary docelowe (całkowite, co najmniej 1 px)
 */
export function fitWithin(
  width: number,
  height: number,
  maxSide: number,
): { width: number; height: number } {
  const scale = Math.min(1, maxSide / Math.max(width, height));
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

/**
 * Zmniejsza zdjęcie z aparatu do JPEG o dłuższym boku 512 px; gdy przeglądarka nie umie go zdekodować, zwraca oryginał.
 *
 * @param {File} file - Plik wybrany przez rodzica
 * @returns {Promise<File>} Plik gotowy do wysłania do PocketBase
 */
export async function prepareChildPhoto(file: File): Promise<File> {
  try {
    const bitmap = await createImageBitmap(file);
    const size = fitWithin(bitmap.width, bitmap.height, CHILD_PHOTO_MAX_SIDE_PX);
    const canvas = document.createElement("canvas");
    canvas.width = size.width;
    canvas.height = size.height;
    canvas.getContext("2d")?.drawImage(bitmap, 0, 0, size.width, size.height);
    bitmap.close();
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", CHILD_PHOTO_JPEG_QUALITY),
    );
    return blob ? new File([blob], "photo.jpg", { type: "image/jpeg" }) : file;
  } catch {
    return file;
  }
}

/**
 * Buduje URL miniatury zdjęcia dziecka (pole chronione, więc wymaga tokenu plików).
 *
 * @param {ChildRecord} child - Dziecko z polem `photo`
 * @param {string} fileToken - Token z `pb.files.getToken()`
 * @returns {string | null} URL miniatury lub null, gdy dziecko nie ma zdjęcia
 */
export function childPhotoUrl(child: ChildRecord, fileToken: string): string | null {
  if (!child.photo) return null;
  return pb.files.getURL(child, child.photo, { thumb: CHILD_PHOTO_THUMB, token: fileToken });
}
