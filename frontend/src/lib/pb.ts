import PocketBase from 'pocketbase';
import { env } from '$env/dynamic/public';

// $env/dynamic/public is resolved at RUNTIME on the Node server and shipped to
// the browser — so PUBLIC_PB_URL from the systemd unit (or .env) works without
// a rebuild. import.meta.env.PUBLIC_* does NOT work in SvelteKit (Vite only
// exposes VITE_-prefixed vars there), which silently broke this before.
const PB_URL = env.PUBLIC_PB_URL || 'http://127.0.0.1:8090';

export const pb = new PocketBase(PB_URL);
pb.autoCancellation(false);

// Refresh the auth record on every page load so custom fields (role, name)
// are always current — the stored JWT may predate a role change.
if (typeof window !== 'undefined' && pb.authStore.isValid) {
  pb.collection('users').authRefresh().catch(() => pb.authStore.clear());
}

/**
 * URL for a contact's photo. Pass a thumb (e.g. '100x100') for list views —
 * omit it only when the full-size original is actually needed (lightbox).
 */
export function photoUrl(
  record: { id: string; photo?: string; collectionId?: string; collectionName?: string },
  thumb?: string
): string {
  if (!record.photo) return '';
  return pb.files.getURL(record, record.photo, thumb ? { thumb } : {});
}
