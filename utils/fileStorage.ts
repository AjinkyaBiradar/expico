import * as FileSystem from 'expo-file-system/legacy';

function getReceiptsDir(): string {
  const base = FileSystem.documentDirectory || FileSystem.cacheDirectory || '';
  if (!base) return '';
  return base.endsWith('/') ? `${base}receipts/` : `${base}/receipts/`;
}

/**
 * Ensures that the local receipts directory exists.
 */
export async function ensureReceiptsDirectoryAsync(): Promise<string> {
  const dir = getReceiptsDir();
  if (!dir) return '';
  const dirInfo = await FileSystem.getInfoAsync(dir);
  if (!dirInfo.exists) {
    await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
  }
  return dir;
}

/**
 * Saves a picked image to local application documents storage.
 * Returns the local file URI to store in SQLite.
 */
export async function saveReceiptImageAsync(sourceUri: string): Promise<string> {
  const receiptsDir = await ensureReceiptsDirectoryAsync();
  if (!receiptsDir) {
    return sourceUri;
  }
  const fileExt = sourceUri.split('.').pop()?.split('?')[0] || 'jpg';
  const fileName = `receipt_${Date.now()}_${Math.random().toString(36).substring(2, 8)}.${fileExt}`;
  const destinationUri = `${receiptsDir}${fileName}`;

  await FileSystem.copyAsync({
    from: sourceUri,
    to: destinationUri,
  });

  return destinationUri;
}

export const saveReceiptLocally = saveReceiptImageAsync;

/**
 * Deletes a receipt photo from local storage.
 */
export async function deleteReceiptImageAsync(fileUri: string | null): Promise<void> {
  if (!fileUri) return;
  try {
    const fileInfo = await FileSystem.getInfoAsync(fileUri);
    if (fileInfo.exists) {
      await FileSystem.deleteAsync(fileUri, { idempotent: true });
    }
  } catch (error) {
    console.warn('Failed to delete receipt file:', error);
  }
}
