import * as ImagePicker from 'expo-image-picker';
import { detectImageFormat, readLocalFile } from './files';
import { supabase } from './supabase';

/**
 * The logos bucket is public, so a stored logo has a stable URL that both the
 * app and the PDF renderer can fetch without signing.
 */
export function logoUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  return supabase.storage.from('logos').getPublicUrl(path).data.publicUrl;
}

export type PickedLogo = { path: string; uri: string };

/**
 * Pick an image and upload it to the `logos` bucket.
 *
 * `previousPath` is deleted once the new object is in place. Each upload takes a
 * fresh key rather than overwriting: objects are served with an hour of cache,
 * so reusing the key would leave the old logo on both the CDN and every
 * generated document until it expired.
 */
export async function pickAndUploadLogo(
  businessKey: string,
  previousPath?: string | null,
): Promise<PickedLogo | null> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) throw new Error('Allow photo access to choose a logo.');

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    quality: 0.9,
    allowsEditing: true,
    // Square, so it sits cleanly in the document header.
    aspect: [1, 1],
  });
  if (result.canceled || !result.assets[0]) return null;

  const asset = result.assets[0];
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) throw new Error('Not signed in.');

  const bytes = await readLocalFile(asset.uri);
  const format = detectImageFormat(bytes);
  if (!format) throw new Error('Use a PNG or JPEG image for the logo.');

  const path = `${userId}/${businessKey}-${Date.now()}.${format.extension}`;
  const { error } = await supabase.storage
    .from('logos')
    .upload(path, bytes, { contentType: format.contentType, upsert: true });
  if (error) throw error;

  if (previousPath && previousPath !== path) {
    // Best effort: a stale object costs a little storage, not a broken logo.
    await supabase.storage.from('logos').remove([previousPath]);
  }

  return { path, uri: asset.uri };
}
