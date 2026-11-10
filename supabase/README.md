# Supabase development setup (P2)

Use the existing isolated development project. Do not run the bootstrap over an
existing customer database. The application needs only its URL and publishable
key; no secret/service-role key or database password is needed.

1. Open the project in the Supabase Dashboard. Open **SQL Editor → New query**.
   If you have not applied P2 yet, open `artifacts/p2-bootstrap.sql` from this
   repository, paste the entire file and click **Run** once. Recreate that local
   bundle if needed with `corepack.cmd pnpm db:bundle`. The reviewed migrations
   in `supabase/migrations/` are the source of truth; the bundle is atomic.
   Existing objects cause rollback rather than replacement. Stop on any error;
   do not delete tables or policies to retry.
2. If unsure whether P2 was already applied, run `supabase/verify-bootstrap.sql`
   first. All 16 expected tables must exist with RLS, both public workspace
   functions must exist and the private bucket must match. This checks structure,
   not authenticated tenant isolation. Do not rerun bootstrap if already applied.
3. Open **Authentication → URL Configuration**. Set **Site URL** to
   `http://localhost:3000`. Add `http://localhost:3000/**` under **Redirect URLs**
   and save. This wildcard is for the isolated local development project only.
   Keep email/password authentication and email confirmation enabled.
4. Open the project's **Connect** dialog for the Project URL and publishable key
   (`sb_publishable_...`). If `.env.local` does not exist, copy `.env.example` to
   `.env.local`. Keep these values only in `.env.local`:

   ```dotenv
   NEXT_PUBLIC_APP_URL=http://localhost:3000
   NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLISHABLE_KEY
   AI_ASSISTANT_ENABLED=false
   ```

   Leave secret and OpenRouter credentials blank. Never paste keys in chat.
   If the assistant has already preserved your configuration in `.env.local`,
   keep that file rather than copying the blank template over it.
5. In PowerShell in the project directory, stop a running development server with
   **Ctrl+C**, then run `corepack.cmd pnpm dev`. Open
   `http://localhost:3000/signup` (use `localhost`, consistently).
6. Register with a test email you control and a password of at least 12 characters.
   Open the confirmation link in the same browser/profile that started signup,
   so the PKCE verification cookie is available. Create a workspace; check its
   name/location in Settings, save a change, sign out and sign back in.
7. Repeat with a second test account in a separate browser profile and a separate
   workspace. Hosted two-account isolation, recovery and protected-route checks
   are required before P2 is complete. Do not add customer inventory yet.

If confirmation/recovery email does not arrive, check spam and the project's Auth
logs and email configuration. Supabase's default development email sender has
restrictions and rate limits; repeated retries can exhaust it. Do not disable
email confirmation merely to label that workflow verified.

Official references: [redirect configuration](https://supabase.com/docs/guides/auth/redirect-urls),
[API keys](https://supabase.com/docs/guides/getting-started/api-keys),
[password and email flows](https://supabase.com/docs/guides/auth/passwords).

Local checks: `corepack.cmd pnpm check`; PostgreSQL permission suite only:
`corepack.cmd pnpm test:security`. Local tests do not replace hosted verification.
