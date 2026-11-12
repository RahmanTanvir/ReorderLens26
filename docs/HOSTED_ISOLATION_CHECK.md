# P9 private import read-isolation verifier

Run from the application root in your own interactive terminal:

```powershell
node scripts/verify-hosted-isolation.ts
```

Use the exact Supabase project connected to the deployed test site. Obtain its
HTTPS project origin and `sb_publishable_` key from that project's settings.
The tool displays the accepted hostname before requesting account credentials.
Do not use a secret/service-role/legacy key. Do not send keys, passwords or tokens
in chat. The script uses Node24's built-in TypeScript support, with no install.

Prerequisites:

- Two distinct confirmed test accounts, each with its own existing workspace and
  a committed fictional QA import. Neither account may share any workspace with
  the other. Use only the previously approved fictional QA data, not customer CSVs.
- Both accounts must be able to read their own imported `suppliers.csv`. If the
  second account has no committed import, prepare its fictional QA fixture first;
  a missing-fixture error is not an isolation pass.
- An interactive terminal. All answers, including passwords, are hidden. Nothing
  is read from `.env.local`, so local development settings cannot silently select
  the wrong target. No credential/session file is written.

Enter the requested project origin, publishable key and two test-account email/
password pairs locally. Type `VERIFY` at the final prompt to run. Any other answer
cancels before authentication. Never pipe credentials into a command or put them
in shell arguments/history. The tool accepts only HTTPS `*.supabase.co` origins,
with no credentials, custom path, query, fragment or port.

The verifier performs12 checks with actual password-authenticated identities:
distinct users/disjoint memberships, successful own import/CSV reads, then foreign
import-row denial and foreign/anonymous/public-route CSV denial in both directions.
Positive controls prevent missing files from producing false success. A foreign
401, network failure or server5xx does not count as policy enforcement. A public
Storage route is probed only to verify denial; no public/signed link is created
or shared, and bucket settings are never changed.

It authenticates and revokes only the two sessions it creates (`scope=local`);
existing browser sessions should remain intact. It does not create accounts,
send recovery emails, upload/update/delete files, call business mutations, change
RLS or run SQL. Successful output contains check names and booleans only, saved
to ignored `artifacts/p9-hosted-storage.json`. Failure prints only a fixed code,
never raw provider responses, user IDs, emails, passwords, tokens or CSV bodies.

Reply with the pass count or failure code only. Do not share terminal recordings
that contain pasted credentials. If a code reports an exposed CSV or import row,
stop real-data use and investigate before calling the isolation gate passed.

This is a read-access check. It does not verify Storage write policies, explicit
foreign-workspace HTTP headers, same-profile account switching, load, backups,
generated schema types or production approval. Its transport tests are mocked;
only an actual run against the selected target supplies hosted evidence.

## Remaining browser session/header checks

Use only the two existing test accounts and fictional workspaces.

1. Sign in as A in one browser profile. Open its workspace. In the browser's
   developer console, read its workspace ID (a record identifier, not a token):

   ```js
   document.querySelector('select[aria-label="Active workspace"]').value
   ```

2. Sign out A, then sign in B in that same profile. Refresh Inventory and the
   workspace picker. No A workspace/catalog may remain visible.
3. While signed in B, replace the placeholder below with A's workspace ID and
   run this read-only same-origin request in the developer console:

   ```js
   (await fetch('/api/overview', {
     headers: { 'X-Workspace-Id': 'WORKSPACE_A_UUID' },
     cache: 'no-store'
   })).status
   ```

   Expect403. B should still be able to use its own workspace afterward. Do not
   paste session cookies, passwords, tokens or full network captures into chat;
   report only whether the session stayed separate and the HTTP status.

These two checks do not authorize changing policies or probing real customer data.
