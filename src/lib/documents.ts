import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { supabase } from './supabase';

export type DocumentKind = 'invoice' | 'quotation';

type GenerateResult = { url: string; path: string; filename: string };

/**
 * Asks the Edge Function for a fresh PDF and hands back the signed URL.
 * The same function renders both kinds; only the body key differs.
 */
export async function generateDocument(
  kind: DocumentKind,
  id: string,
): Promise<GenerateResult> {
  const body = kind === 'invoice' ? { invoice_id: id } : { quotation_id: id };
  const { data, error } = await supabase.functions.invoke('generate-invoice-pdf', { body });
  if (error) throw error;

  const result = data as Partial<GenerateResult> & { error?: string };
  if (result?.error) throw new Error(result.error);
  if (!result?.url) throw new Error('The function did not return a document URL.');

  return {
    url: result.url,
    path: result.path ?? '',
    filename: result.filename ?? `${kind}.pdf`,
  };
}

/**
 * Generate, download and hand the file to the system share sheet — which is what
 * puts a real PDF attachment into WhatsApp, Gmail, Drive and the rest. Sharing a
 * remote URL is not enough: the sheet needs a local file to attach.
 */
export async function shareDocument(kind: DocumentKind, id: string): Promise<void> {
  const { url, filename } = await generateDocument(kind, id);

  if (!(await Sharing.isAvailableAsync())) {
    throw new Error('Sharing is not available on this device.');
  }

  // A fresh copy every time: the document may have changed since the last share,
  // and a stale cache file would quietly send the old figures.
  const target = new FileSystem.File(FileSystem.Paths.cache, filename);
  try {
    if (target.exists) target.delete();
  } catch {
    // A cache file we cannot remove is not worth failing the share over; the
    // download below overwrites it anyway.
  }

  const file = await FileSystem.File.downloadFileAsync(url, target, { idempotent: true });

  await Sharing.shareAsync(file.uri, {
    mimeType: 'application/pdf',
    UTI: 'com.adobe.pdf',
    dialogTitle: kind === 'invoice' ? 'Send invoice' : 'Send quotation',
  });
}
