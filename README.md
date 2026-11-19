# Stripe Singapore Community Hackathons

A multi-event platform with public project galleries, participant teams and submissions, sponsor credit allocation, and an organizer dashboard. Built with Next.js App Router, React, NextAuth 4, Prisma 6, and Neon PostgreSQL.

## Local setup

Use Node.js 24 and npm. Copy `.env.example` to `.env` only for a new installation; preserve existing values when updating.

```sh
npm install
npm run db:generate
npm run db:migrate
npm run dev
```

Open `http://localhost:3000`. The event directory starts empty until an administrator creates an event. Missing authentication configuration is reported on the sign-in screen; it does not create a bypass account.

### Environment

| Variable                     | Purpose                                                                                                                               |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`               | Direct Neon PostgreSQL connection, used by Prisma migrations.                                                                         |
| `DATABASE_URL_POOLED`        | Pooled Neon connection, used by the application. Both URLs must target the same database.                                             |
| `NEXTAUTH_URL`               | Full application origin, such as `http://localhost:3000`; use the HTTPS production origin when deployed.                              |
| `NEXTAUTH_SECRET`            | Cryptographically random authentication secret.                                                                                       |
| `GOOGLE_ID`, `GOOGLE_SECRET` | Google OAuth web application credentials.                                                                                             |
| `ADMIN_EMAILS`               | Comma-separated administrator emails, such as `admin@example.com`. Users must still authenticate with a verified identity.            |
| `CREDITS_ENCRYPTION_KEY`     | A separate 32-byte key encoded as base64 or 64 hexadecimal characters, used to encrypt credit vouchers. Keep it stable and backed up. |
| `TEST_DATABASE_URL`          | Direct PostgreSQL URL explicitly enabled for integration/browser tests. Each run creates and removes a unique temporary schema.       |
| `SEED_DEMO`                  | Set to `true` only for the optional development seed.                                                                                 |

Generate each secret independently:

```sh
node -e "console.log(require('node:crypto').randomBytes(32).toString('base64'))"
```

Never use placeholder values in production. Existing S3 settings are preserved but are not required by this version, which accepts project links rather than file uploads.

Team invitations appear in the participant portal only; no invitation emails are sent. Share the hackathon link with teammates and ask them to open the Team tab. A credit encryption key is required before importing or revealing vouchers. Rotating it requires re-encrypting stored vouchers; replacing it alone makes existing values unreadable.

### Google login

Register the exact Google callback URLs:

```text
http://localhost:3000/api/auth/callback/google
https://YOUR_DOMAIN/api/auth/callback/google
```

Google is the only sign-in provider. The app requires a verified Google email and preserves Google account identity without automatically linking unrelated accounts by email.

Use a Google account listed in `ADMIN_EMAILS` to access `/admin`. Email imports grant participant access only; they never grant administrator privileges.

## Organizer workflow

1. Create a draft at `/admin`. Set its permanent URL, timezone, event content, team size, tracks, and separate submission/voting windows. Datetimes use the selected event timezone and are stored in UTC.
2. Add schedule entries, resources, prizes, meeting details, and private attendee instructions. Publish by setting the event to **Active**. Published URLs cannot change, and published events cannot revert to drafts.
3. Import participants from pasted emails or CSV with `email` and optional `name` columns. Review the preview and correct invalid addresses. Repeating an import preserves registrations and teams.
4. Create sponsor offers, upload unique codes or links, and preview allocation. Assign one voucher per participant per offer to everyone or selected participants. Insufficient stock changes nothing; repeated allocation preserves existing assignments.
5. Inspect projects and private voting results. Hide or restore submitted projects as needed. Voters can withdraw their previously cast vote for an unavailable project. Exports are administrator-only.
6. Close submissions and voting independently, or mark the event **Ended** to close both. The gallery remains public. Credit claims continue until each offer expires.

Example participant import:

```csv
email,name
builder@example.com,Example Builder
teammate@example.com,Example Teammate
```

Voucher imports accept one code or redemption URL per line, or a CSV column headed `code`, `url`, `link`, or `value`. Set a shared redemption URL on the offer for code-based vouchers. Values are encrypted at rest and appear only to their assigned participant after claiming.

## Participant and gallery behavior

- The homepage opens the Google sign-in screen directly. Public galleries remain accessible at `/hackathons`; guests can browse event galleries and project details. Any signed-in user can vote with the event's allowance.
- Imported participants access `/hackathons/EVENT_SLUG/portal`. Create a solo team or invite imported email addresses; recipients accept in their portal. Invitations do not reserve seats.
- A person belongs to one team per event. Team size is a maximum. Teammates edit one shared project; the owner manages membership before first submission.
- Drafts stay private. Publication requires a name, description, video URL, GitHub repository URL, any required tracks, and explicit consent. Demo URL is optional.
- First publication locks the roster. Project edits remain possible until submissions close. Admin-hidden submissions remain hidden after participant edits.
- YouTube links receive previews. Other videos use a demo-link fallback when available, with a separate video link.
- Voting allows one vote per project and withdrawal while voting is open. Teammates cannot vote for their project. Vote totals never appear in public responses.
- Claiming reveals an assigned voucher. “Claimed” means revealed here; external redemption is not automatically verified.

## Development fixtures and checks

### Typography

The shared font stacks prefer Söhne for interface text and Söhne Mono for code, with bundled Geist fonts as fallbacks. Licensed Söhne webfont files are not included. To serve these fonts to every visitor, add your licensed WOFF2 files under `public/fonts/` and register matching `@font-face` declarations in `app/globals.css` (family names `Söhne` and `Söhne Mono`, with the weights supplied by your files and `font-display: swap`). FF Fago is not used as the interface font.

### Fixtures

The optional seed adds two sample events, six projects, example identities, and a sponsor offer with no real voucher inventory. It creates no votes, passwords, OAuth credentials, or sign-in sessions. Existing records are never overwritten and repeated runs are idempotent. Use it only on a development database.

PowerShell:

```powershell
$env:SEED_DEMO = "true"
npm run db:seed
Remove-Item Env:SEED_DEMO
```

POSIX shell:

```sh
SEED_DEMO=true npm run db:seed
```

The fixture utility is exported as `seedDemo(prisma)` from `prisma/demo-data.ts`; importing it has no side effects. It requires `SEED_DEMO=true` and refuses `NODE_ENV=production`. Example identities are fixtures, not usable login credentials.

```sh
npm test
npm run lint
npm run build
npm run test:e2e
```

Unit tests run without an external database. When `TEST_DATABASE_URL` is supplied, `npm test` also exercises PostgreSQL transactions, including concurrent team joins, vote quotas, and voucher allocation. The suite creates a random `hackathon_test_…` schema and deletes only that schema afterward. It never resets the application schema.

Browser tests require a prior production build and `TEST_DATABASE_URL`. Their runner creates another temporary schema, starts the app on port 3101, exercises guest/participant/admin behavior, and cleans up. It uses installed Chrome/Edge or Playwright Chromium; `PLAYWRIGHT_CHROMIUM_EXECUTABLE` can specify a browser executable. OAuth policies have automated coverage; a real Google smoke test needs configured credentials and registered callbacks.

## Deployment and operations

Keep source files focused and under 500 lines as a maintenance guideline. Build and lint do not enforce a line limit.

Configure the hosting environment, then run `npm run db:generate`, `npm run db:migrate`, and `npm run build` in the release process. `db:migrate` applies committed migrations; do not use `prisma db push` for production releases. Run `npm start` on Node or use a compatible Next.js host. Deployment is not performed automatically.

Before launch, confirm an administrator can sign in, open a gallery, import a test participant, create and accept a portal team invitation, and claim a test sponsor voucher. Check migration status with `npx prisma migrate status`. The homepage and sign-in screen provide basic availability checks; no separate health endpoint is exposed.

Monitor server errors through host logs and provider dashboards. Log operation names and error codes when investigating; never log OAuth tokens, connection strings, participant imports, or voucher plaintext. Back up the encrypted database and keep the voucher encryption key available for recovery.
