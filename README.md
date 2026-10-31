# Wave Log

Wave Log is a personal surfing journal. It will later support surf-session logging, marine conditions, spot-specific ratings, and personalized surf-condition recommendations.

## Getting Started

Install dependencies:

```sh
npm install
```

Create a local environment file:

```sh
cp .env.example .env.local
```

Set the Supabase values in `.env.local`:

```sh
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-supabase-publishable-or-anon-key
```

Run locally:

```sh
npm run dev
```

Build for production:

```sh
npm run build
```

## Supabase Setup

Create a Supabase project, then copy these values from the project dashboard:

- `VITE_SUPABASE_URL`: Project URL from the Connect dialog or Integrations > Data API
- `VITE_SUPABASE_ANON_KEY`: publishable key from the Connect dialog or Settings > API Keys

Use only the publishable client key, or the legacy anon key if that is what your project has. Do not use a secret key or legacy service-role key in this frontend.

Enable Kakao-only authentication (existing configuration can be kept if it matches):

1. Open the Supabase dashboard for the project.
2. Go to Authentication > Sign In / Providers.
3. Enable Kakao with the Kakao REST API key as Client ID and the Client Secret. Keep these credentials only in Supabase, never in Vite variables.
4. Enable **Allow users without an email** in the Kakao provider settings.
5. Disable the Email provider and any other enabled providers if the project must enforce Kakao-only login. Removing email UI alone does not disable server-side password authentication.

In Kakao Developers, enable Kakao Login and the nickname consent item (`profile_nickname`). This app requests only nickname, not email. Register the Supabase callback URL shown in the provider settings: `https://<project-ref>.supabase.co/auth/v1/callback`. This callback is the same for local frontend development and GitHub Pages when using the hosted Supabase project.

Configure auth URLs:

1. Go to Authentication > URL Configuration.
2. Set Site URL to the GitHub Pages URL, for example `https://<github-user>.github.io/wave-log/`.
3. Add `http://localhost:5173/wave-log/` to Redirect URLs for local development.
4. Add the GitHub Pages URL, for example `https://<github-user>.github.io/wave-log/`, to Redirect URLs.
5. Also add `http://127.0.0.1:5173/wave-log/` if opening the local app with that hostname. If Vite chooses another port, allow that exact URL as well.

For GitHub Pages deployment, add repository secrets in GitHub:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

The GitHub Actions workflow passes these values to `npm run build` so Vite can include them in the deployed static app.

## Authentication And Testing

The single Kakao button calls Supabase OAuth and returns to the current origin plus Vite's base path. The existing Supabase browser client processes the callback, persists the session, and refreshes tokens. No callback route or GitHub Pages rewrite is needed.

The auth context restores the session, subscribes to auth changes, and displays callback or session errors. A nickname is shown when available; otherwise the display name is "서퍼". For future database records use `useAuth().userId` (Supabase `auth.users.id`), never nickname, email, or Kakao's provider ID.

1. Preserve any existing `.env.local`; only create one from the example if it is absent. Run `npm run dev` and open the printed URL with `/wave-log/`.
2. Select "카카오로 시작하기", complete Kakao consent, and verify the main screen and nickname (or fallback).
3. Refresh to check session persistence, then log out to return to the login screen.
4. Cancel a new Kakao login to verify the error and retry path. Test an account without email consent too.
5. Push to `main` after configuring the existing GitHub Actions secrets. Repeat the same checks on `https://<github-user>.github.io/wave-log/`.

Real OAuth verification requires a Kakao account and the dashboard settings above. Existing email sessions are not automatically revoked by this frontend change.

Reference: [Supabase Kakao setup](https://supabase.com/docs/guides/auth/social-sign-in/auth-kakao).
