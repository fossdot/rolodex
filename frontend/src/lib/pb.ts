import PocketBase from 'pocketbase';

const PB_URL = typeof window !== 'undefined'
  ? (import.meta.env.PUBLIC_PB_URL || 'http://127.0.0.1:8090')
  : 'http://127.0.0.1:8090';

export const pb = new PocketBase(PB_URL);
pb.autoCancellation(false);
