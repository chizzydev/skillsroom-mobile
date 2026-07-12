# Skillsroom Mobile Architecture

Skillsroom Mobile is an Expo + TypeScript app built Android-first and kept iOS-ready from day one.

The app lives at `C:\Users\HP\sr-mobile` to avoid OneDrive path problems and long-folder Android issues.

## Architecture Decision

This is a native player app powered by `skill-rooms-api`.

It is not:

- A WebView wrapper.
- A copy-paste of Decide Mobile.
- A replacement for the web admin dashboard.
- A place where client code decides wallet, funding, or result truth.

## Current Stack

- Expo
- TypeScript
- Expo Router
- React Native
- TanStack Query for server state
- Zustand for small local auth state
- Expo SecureStore for tokens
- API wrappers under `src/api`

## Canonical Route Tree

This is the target route shape. Some routes do not exist yet; they are part of the planned implementation.

```text
app/
  _layout.tsx
  index.tsx
  (auth)/
    _layout.tsx
    login.tsx
    register.tsx
    forgot-password.tsx
    reset-password.tsx
    verify-email.tsx
  (app)/
    _layout.tsx
    (tabs)/
      _layout.tsx
      chat.tsx
      rooms.tsx
      tournaments.tsx
      wallet.tsx
      profile.tsx
    chat/
      [channelId].tsx
      dm-requests.tsx
    rooms/
      new.tsx
      [matchId].tsx
      [matchId]/funding.tsx
      [matchId]/live.tsx
      [matchId]/result.tsx
    tournaments/
      [tournamentId].tsx
      [tournamentId]/register.tsx
      [tournamentId]/bracket.tsx
    wallet/
      top-up.tsx
      payout.tsx
      history.tsx
    profile/
      edit.tsx
      game-accounts.tsx
      payout.tsx
      streaming.tsx
```

## Feature Boundaries

### `src/api`

Typed wrappers around the API. They should return product objects and throw plain, displayable errors.

Current wrappers:

- `auth.ts`
- `chat.ts`
- `client.ts`
- `profile.ts`
- `rooms.ts`
- `session.ts`
- `tournaments.ts`
- `wallet.ts`

Future wrappers:

- `streaming.ts` if room-level stream actions need a separate module.
- `notifications.ts` when push/in-app updates are introduced.

### `src/store`

Only small client-owned state belongs here.

Allowed:

- Auth session bootstrap state.
- Current selected local tab/filter.
- Draft UI state that is not money or room truth.

Not allowed:

- Wallet balance truth.
- Room funding truth.
- Result approval truth.
- Admin decision truth.

### `src/features`

Feature folders own screens and feature-specific components.

Target folders:

- `auth`
- `chat`
- `rooms`
- `room-detail`
- `wallet`
- `tournaments`
- `profile`
- `streaming`
- `notifications`

### `src/components`

Shared UI only: buttons, cards, badges, screen shells, feedback, empty states, and future motion utilities.

## Security Rules

- Mobile sends bearer tokens to the API.
- Tokens are stored in SecureStore.
- Refresh is handled through the API client, not repeated inside screens.
- Server remains final authority for money, entry amount, funding status, result status, and payout status.
- Native client never credits wallet.
- Native client never unlocks funds.
- Native client never approves funding or results.
- Admin/operator actions stay web-owned for v1.

## Current Scaffold Truth

What should stay:

- Expo Router structure.
- SecureStore session storage.
- API client with refresh support.
- TanStack Query provider.
- Bottom tabs for Chat, Rooms, Tourneys, Wallet, Profile.
- Theme constants and shared UI primitives.

What must be deepened before this is a real product:

- Native room detail route.
- Proof upload.
- Balance payment for rooms/tournaments.
- Wallet top-up flow.
- Chat thread/DM composer.
- Tournament detail and registration.
- Profile editing, game accounts, payout details, and streaming setup.
- Live update handling.
- Android device QA.

## API Origin Note

Native Android requests may not send browser `Origin` or `Referer` headers. The API has been patched so authenticated bearer-token mutations can pass trusted-origin middleware without those browser headers. Browser requests still keep origin protection.

## iOS Readiness

Do not add Android-only assumptions unless documented. If Android needs `adb reverse`, keep that in setup docs only. Expo APIs should remain cross-platform so iOS can come later without a rewrite.
