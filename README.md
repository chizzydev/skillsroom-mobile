# Skillsroom Mobile

Native Android-first app for Skillsroom, built with Expo and TypeScript.

This project lives at `C:\Users\HP\sr-mobile` to avoid OneDrive and long-path Android build issues.

## Status

Current status: Android player app and mobile admin workspace are in active QA.

The app now includes the player-facing Skillsroom experience, native chat, rooms, tournaments, wallet, profile, notifications, public/community screens, and role-gated admin tools. Continue using the implementation docs as the source of truth for remaining release hardening and QA.

Start here:

- `C:\Users\HP\sr-mobile\docs\implementation-plan.md`
- `C:\Users\HP\sr-mobile\docs\web-to-mobile-parity.md`
- `C:\Users\HP\sr-mobile\docs\mobile-architecture.md`
- `C:\Users\HP\sr-mobile\docs\phase-status.md`
- `C:\Users\HP\sr-mobile\docs\android-qa-release-checklist.md`

## Product Target

The first Android release is player-facing:

- Chat
- Rooms
- Tourneys
- Wallet
- Profile

Admin/operator work is available in the mobile app for allowed roles and remains mirrored against the web/API permissions.

## Local Setup

Start the API:

```powershell
cd C:\Users\HP\skill-rooms-api
npm run dev
```

Copy env:

```powershell
cd C:\Users\HP\sr-mobile
Copy-Item .env.example .env
```

For Android emulator:

```env
EXPO_PUBLIC_API_BASE_URL=http://10.0.2.2:4100
EXPO_PUBLIC_WEB_APP_URL=http://10.0.2.2:3100
```

For physical Android with `adb reverse`:

```powershell
adb reverse tcp:4100 tcp:4100
adb reverse tcp:3100 tcp:3100
```

Then use:

```env
EXPO_PUBLIC_API_BASE_URL=http://127.0.0.1:4100
EXPO_PUBLIC_WEB_APP_URL=http://127.0.0.1:3100
```

Install and run:

```powershell
npm install
npm run android
```

Typecheck:

```powershell
npm run typecheck
```

## Security Direction

- Tokens are stored in SecureStore.
- Mobile talks to `skill-rooms-api` directly.
- The server decides money, funding, room, tournament, result, and payout truth.
- The client never credits wallets, unlocks funds, or approves anything.

## Next Step

Run real-device Android QA, confirm production API credentials, and build an internal APK for tester review.
