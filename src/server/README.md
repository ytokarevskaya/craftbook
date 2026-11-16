# Serverová vrstva

Server-only konfigurace, pg pool (max 5), Supabase SSR cookies, přístup k účtu a HTTP ochrany. Web nikdy nečte `.env.ops.local`, nepoužívá privilegovaný Auth klíč ani migrační DB roli. Identitní transakce a profilové operace jsou v `src/modules/identity/service.ts`.
