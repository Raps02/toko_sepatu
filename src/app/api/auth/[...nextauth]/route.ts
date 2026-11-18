// Endpoint bawaan Auth.js (sesi, CSRF, callback login). Ini integrasi pustaka
// pihak ketiga; mutasi data aplikasi tetap lewat Server Actions.
import { handlers } from '@/auth';

export const { GET, POST } = handlers;
