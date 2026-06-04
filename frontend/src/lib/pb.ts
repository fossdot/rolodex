import PocketBase from 'pocketbase';

const PB_URL = typeof window !== 'undefined'
  ? (import.meta.env.PUBLIC_PB_URL || 'http://127.0.0.1:8090')
  : 'http://127.0.0.1:8090';

export const pb = new PocketBase(PB_URL);
pb.autoCancellation(false);

// Refresh the auth record on every page load so custom fields (role, name)
// are always current — the stored JWT may predate a role change.
if (typeof window !== 'undefined' && pb.authStore.isValid) {
  pb.collection('users').authRefresh().catch(() => pb.authStore.clear());
}
