# Skillsroom Mobile Implementation Plan

This is the build plan. Follow it in order unless a production bug forces a small detour.

The principle is simple: build the strongest native foundation once, then move feature by feature. Do not leave vague "come back later" work hidden inside shipped phases. If something is intentionally deferred, it must be named in `phase-status.md`.

## Current Position

Skillsroom Mobile is at Phase 0.

Phase 0 created the Expo foundation, API client, secure auth storage, tabs, and first read screens. It is not yet web-to-mobile parity. Treat it as the foundation, not the finished Android app.

## Non-Negotiables

- Server decides wallet balance, room entry amount, funding status, result status, tournament entry status, and payout status.
- Client never credits money.
- Client never approves funding.
- Client never unlocks funds.
- Client never trusts a displayed amount for payment decisions.
- Errors must be visible immediately on mobile.
- User-facing text must be plain English.
- Native screens should improve cramped web flows, not blindly copy them.
- Admin/operator dashboard remains web-owned for v1.
- Each phase must pass typecheck before it is considered done.

## Phase 0: Foundation

Status: started.

Goal: create the native app foundation without pretending it is feature-complete.

Already present:

- Expo + TypeScript app at `C:\Users\HP\sr-mobile`
- Expo Router auth/app groups
- Bottom tabs: Chat, Rooms, Tourneys, Wallet, Profile
- SecureStore token persistence
- API client with refresh support
- TanStack Query provider
- Zustand auth state
- First-pass screens for auth, rooms, wallet, tournaments, chat, and profile

Acceptance before moving on:

- `npm run typecheck` passes.
- Docs clearly say what is scaffold and what is not done.
- API native bearer-token origin behavior is documented.

## Phase 1: Auth And App Shell Hardening

Goal: make login, registration, session restore, logout, and tab shell production-grade.

Build:

- Native login with strong visible feedback.
- Native register with email verification messaging.
- Forgot password request.
- Session bootstrap screen that does not flash wrong routes.
- Logout that clears SecureStore and query cache.
- API unavailable state with retry.
- Plain-language API errors.
- Android keyboard-safe forms.

Acceptance:

- Fresh install opens auth when signed out.
- Login persists across app restart.
- Expired access token refreshes silently.
- Invalid refresh token signs out cleanly.
- Register tells users to verify email where applicable.
- All auth errors appear without scrolling.

## Phase 2: Profile And Readiness

Goal: stop room/tournament friction by making setup obvious.

Build:

- Profile overview.
- Edit display name, username, region, city, bio, visibility.
- Age confirmation.
- Game account list and add/edit primary account.
- Payout details.
- Connected stream channel setup or web handoff if OAuth is not native-ready.
- Profile completion card that clearly explains what is missing.

Acceptance:

- User knows exactly why they cannot create/join money rooms.
- Primary game account can be created and selected.
- Payout details are saved for future winnings.
- Profile screen does not use admin/developer language.

## Phase 3: Rooms Lobby, Create Room, Join By Code

Goal: make the core private room flow clean on Android.

Build:

- Rooms lobby with Open, Awaiting Funding, Funding Review, Live, Done filters.
- Create room screen with game, ruleset, entry amount, title.
- Join by code screen.
- Profile/game-account prerequisite card above the create form.
- Fast pending states that cannot get stuck silently.
- Clear server error mapping.

Acceptance:

- User can create a room after profile/game-account setup.
- User can join another room by code.
- Room appears in the correct queue after refresh.
- If setup is incomplete, the screen says exactly what to fix and links to Profile.

## Phase 4: Room Detail Native Flow

Goal: replace the broad web-style room page with a focused Android flow.

Build:

- Route: `rooms/[matchId]`
- Sticky section nav: Overview, Players, Funding, Live, Result
- Current-step card near the top.
- Room code/share card.
- Player slots with game handles and funding status.
- Funding section with balance/manual options.
- Live stream section with official/player streams.
- Result section with submit/respond status.
- Checkpoints/history lower down.

Acceptance:

- On a phone, user sees the next action without hunting.
- Funding proof cannot falsely mark Play/Evidence complete.
- Live section is responsive and never overflows horizontally.
- Admin decisions update through refresh/live update path.
- Manual refresh fallback is visible if live updates delay.

## Phase 5: Wallet

Goal: make Skillsroom Balance usable without weakening security.

Build:

- Balance overview.
- Locked funds.
- Pending top-ups.
- Top-up proof upload.
- Payout request.
- Wallet history.
- Plain pending/rejected/approved states.

Acceptance:

- Pending top-ups are never shown as spendable.
- Approved top-up updates available balance after server approval.
- Payout requests use winnings only.
- User can understand exactly where money is: available, locked, pending, or paid out.

## Phase 6: Chat And DMs

Goal: native chat without repeating the old DM layout fight.

Build:

- Channel list.
- Global Chat.
- DM list and DM thread.
- Composer fixed above keyboard.
- Media-safe message bubbles.
- Manual image/document load rules.
- Reactions and basic message actions.
- Realtime or polling fallback.

Acceptance:

- Composer never disappears after media load.
- Sender sees their own uploaded media correctly.
- Receiver rules still respect manual load/download behavior.
- DM is first-class, not a generic channel loading state.

## Phase 7: Tournaments

Goal: bring the multipurpose tournament system into Android cleanly.

Build:

- Tournament list.
- Tournament detail.
- Register.
- Pay entry from balance or manual proof.
- Check-in.
- Bracket/standings read view.
- Host/official stream display where relevant.

Acceptance:

- User can discover tournaments.
- User can enter with balance/manual option.
- Tournament entry state is clear.
- No admin words like seed IDs or internal audit language leak to players.

## Phase 8: Streaming

Goal: make watching matches feel native and clear.

Build:

- Room stream cards.
- Connected profile channels display.
- Manual stream link attachment.
- YouTube/Twitch embeds where native webview/player support is stable.
- TikTok link/fallback.
- Clear "no live stream yet" state.

Acceptance:

- Connected channel and room stream are not confused.
- No horizontal overflow.
- User understands whether there is no channel, no live video, or no room stream link.

## Phase 9: Live Updates And Notifications

Goal: reduce manual refresh.

Build:

- Room state refresh on funding approval.
- Result approval refresh.
- Wallet top-up approval refresh.
- Tournament entry refresh.
- Push notification foundation or polling fallback.
- Plain toasts for important changes.

Acceptance:

- Funding approval changes the funding card.
- Result approval changes the result/status card.
- Wallet balance refreshes after approval.
- User gets a visible message when something important changes.

## Phase 10: Android QA And Release Hardening

Goal: make Android ready for real testers.

Build:

- Real-device QA checklist.
- Production API env profile.
- Offline and slow-network states.
- Error reporting plan.
- EAS build readiness.
- Icon/splash polish.
- Store-safe naming and permissions.

Acceptance:

- App works on a physical Android phone.
- App survives logout/login/restart.
- Core room flow can be completed by two users.
- APK/AAB build path is documented.

## Phase 11: iOS Readiness

Goal: prepare without distracting Android launch.

Build later:

- iOS device QA.
- Apple sign-in decision if needed.
- iOS keyboard/safe-area pass.
- EAS iOS profile.

Acceptance:

- No Android-only code blocks iOS.
- iOS work is a platform pass, not a rewrite.

## How To Continue

Use this request format:

```text
Implement Phase 1A: Auth and App Shell Hardening.
Follow C:\Users\HP\sr-mobile\docs\implementation-plan.md and update phase-status.md when done.
```

Do not jump to a later phase unless the earlier phase is marked complete or the user explicitly pauses it.
