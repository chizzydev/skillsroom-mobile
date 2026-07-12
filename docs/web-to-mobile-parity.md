# Skillsroom Web-To-Mobile Parity Map

This document is the mobile source of truth. Do not keep re-reading Decide Mobile to decide what Skillsroom Mobile should become. Decide Mobile is only a process reference; the Skillsroom web app and API are the actual product reference.

## Product Rule

Skillsroom Mobile must feel like the Android version of Skillsroom, not a copied web page and not a generic Expo starter.

The first release is player-facing only:

- Chat
- Rooms
- Tourneys
- Wallet
- Profile

Admin/operator work remains web-owned unless a later product decision promotes a specific admin lane to native.

## Canonical Web Sources

Use these files when checking parity:

- App shell and mobile tab order: `C:\Users\HP\skill-rooms-web\src\components\layout\AppShell.tsx`
- Chat route: `C:\Users\HP\skill-rooms-web\src\app\chat\page.tsx`
- Chat client: `C:\Users\HP\skill-rooms-web\src\components\community\GlobalLobbyClient.tsx`
- Rooms lobby: `C:\Users\HP\skill-rooms-web\src\app\matches\page.tsx`
- Create room: `C:\Users\HP\skill-rooms-web\src\app\matches\new\page.tsx`
- Room detail: `C:\Users\HP\skill-rooms-web\src\app\matches\[matchId]\page.tsx`
- Wallet: `C:\Users\HP\skill-rooms-web\src\app\wallet\page.tsx`
- Tournaments: `C:\Users\HP\skill-rooms-web\src\app\tournaments\page.tsx`
- Tournament detail: `C:\Users\HP\skill-rooms-web\src\app\tournaments\[tournamentId]\page.tsx`
- Profile: `C:\Users\HP\skill-rooms-web\src\app\profile\page.tsx`

Use these API route groups:

- `C:\Users\HP\skill-rooms-api\src\routes\auth.ts`
- `C:\Users\HP\skill-rooms-api\src\routes\community.ts`
- `C:\Users\HP\skill-rooms-api\src\routes\games.ts`
- `C:\Users\HP\skill-rooms-api\src\routes\matchRooms.ts`
- `C:\Users\HP\skill-rooms-api\src\routes\profiles.ts`
- `C:\Users\HP\skill-rooms-api\src\routes\streamingAccounts.ts`
- `C:\Users\HP\skill-rooms-api\src\routes\tournaments.ts`
- `C:\Users\HP\skill-rooms-api\src\routes\wallet.ts`

## Route Parity Table

| Web Surface | Web Route | Mobile Target | Release Priority | Mobile Treatment |
| --- | --- | --- | --- | --- |
| Home/marketing | `/` | Not in Android v1 | Later | Keep web-only. Native app starts at auth or tabs. |
| Sign in | `/sign-in` | `(auth)/login` | Phase 1 | Native email/password login, token refresh, clear errors. Google can be web handoff until native OAuth is deliberately added. |
| Register | `/register` | `(auth)/register` | Phase 1 | Native account creation, email verification messaging, no hidden web-only assumptions. |
| Forgot password | `/forgot-password` | `(auth)/forgot-password` | Phase 1 | Native request form with plain feedback. |
| Chat lobby | `/chat` | `(tabs)/chat` | Phase 6 | Native channel list, global chat, DM list, message composer, media-safe layout. |
| Rooms lobby | `/matches` | `(tabs)/rooms` | Phase 3 | Native stats, open/funding/review queues, create room, join by code. |
| Create room | `/matches/new` | `rooms/new` | Phase 3 | Native form. Must show profile/game-account prerequisite before the form. |
| Room detail | `/matches/[matchId]` | `rooms/[matchId]` | Phase 4 | Native flow sections: Overview, Players, Funding, Live, Result. Urgent action comes first. |
| Wallet | `/wallet` | `(tabs)/wallet` | Phase 5 | Balance, locked funds, top-up proof, payout request, history. |
| Tournaments list | `/tournaments` | `(tabs)/tournaments` | Phase 7 | Tournament cards, filters, entry status, empty states. |
| Tournament detail | `/tournaments/[tournamentId]` | `tournaments/[tournamentId]` | Phase 7 | Register, pay from balance/manual, check in, bracket/read-only event view. |
| Profile | `/profile` | `(tabs)/profile` | Phase 2 | Player details, game accounts, payout details, streaming channels. |
| Notifications | `/notifications` | Push/in-app notification center | Phase 9 | Not a bottom tab in Android v1 unless usage proves it. Use notifications for room decisions and wallet review. |
| Admin | `/admin/*` | Web only | Not v1 | Admin, owner, support, and Community Manager stay in web dashboard. |
| Public community pages | `/community/*` | Web only | Later | Public discovery stays web-first. Native can deep-link out later. |

## Feature Parity Rules

### Auth

- Mobile must use API tokens, not web cookies.
- Access and refresh tokens live in SecureStore.
- Failed auth should show a visible toast or banner, not bury errors under scroll.
- Native mutations may not send browser `Origin` or `Referer`; the API already allows bearer-token mutations without those headers.

### Rooms

- The server decides entry amount, room state, funding state, and result state.
- The client can request create/join/pay/submit, but cannot trust its own money or state values.
- Room detail must not become a long confusing page. Use sticky sections and urgent-action cards.
- Profile/game-account requirements must be explained before creation, not only after an API rejection.

### Wallet

- No balance is ever edited by the client.
- Wallet top-ups are pending until admin approval.
- Balance payment locks exact server-side room or tournament entry amount.
- Payout request only uses server-approved winnings.

### Chat

- DM and Global Chat must be first-class.
- The composer must never be pushed off-screen by media.
- Uploaded sender media should render as the sender expects; receivers can still follow manual load/download rules.

### Streaming

- Connected YouTube/Twitch accounts are profile-level channels.
- A match room still needs a room stream link unless provider auto-detect is deliberately enabled and verified.
- TikTok is link/embed/fallback only unless a future API integration is added.

### Tournaments

- Tournaments are multipurpose, not only one game or one format.
- Balance entry and manual entry follow the same server-side locking rules as rooms.
- Brackets and standings should be readable before becoming deeply interactive.

## Native Adaptation Rules

- Build native screens, not WebViews, for core player flows.
- Keep each screen focused on one job.
- Use bottom tabs for the main five player surfaces.
- Use drill-in screens for long flows such as room detail, top-up proof, tournament detail, and profile setup.
- When a feature is not native-ready, show an honest web handoff instead of a fake partial feature.
- Avoid admin/developer words in player UI: no "ops", "audit", "seed ID", "state change", or raw enum labels.

## What Not To Copy Blindly From Web

- Long single-page room detail layout.
- Desktop-first tables.
- Server-action full-page refresh feeling.
- Admin/operator wording.
- Hidden inline-only errors.
- Web-only OAuth assumptions.

The native app should keep Skillsroom's product logic but improve the mobile experience where web is naturally cramped.
