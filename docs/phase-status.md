# Skillsroom Mobile Phase Status

Last updated: 2026-07-09

## Current State

The mobile app has completed Phase 9: Live Updates And Notifications, plus boundary closures for native proof/media upload, native chat attachment upload/download, native streaming OAuth with a production HTTPS bridge callback, native mobile push notifications, native embedded stream playback, shared object storage for evidence/chat files, and native SSE/EventSource live updates.

This means the base app, hardened auth shell, native profile readiness flow, core room lobby/create/join flow, native room detail flow, native wallet flow, native chat/DM flow, native tournament player flow, native streaming/watch flow with embedded players, native SSE live-update layer, polling/push fallback layer, and native push registration path exist, but the Android product is not yet feature-complete or web-to-mobile parity complete.

## Verified So Far

- `npm install` was started and produced `node_modules` plus `package-lock.json`.
- `npm run typecheck` passed in `C:\Users\HP\sr-mobile`.
- `npm run typecheck` passed in `C:\Users\HP\skill-rooms-api` after the native bearer-token origin middleware patch.
- `npm run typecheck` passed again in `C:\Users\HP\sr-mobile` after Phase 1A.
- `npm run typecheck` passed again in `C:\Users\HP\sr-mobile` after Phase 2.
- `npm run typecheck` passed again in `C:\Users\HP\sr-mobile` after Phase 3.
- `npm run typecheck` passed again in `C:\Users\HP\sr-mobile` after Phase 4.
- `npm run typecheck` passed again in `C:\Users\HP\sr-mobile` after Phase 5.
- `npm run typecheck` passed again in `C:\Users\HP\sr-mobile` after Phase 6.
- `npm run typecheck` passed again in `C:\Users\HP\sr-mobile` after Phase 7.
- `npm run typecheck` passed again in `C:\Users\HP\sr-mobile` after Phase 8.
- `npm run typecheck` passed again in `C:\Users\HP\sr-mobile` after Phase 9.
- `npm run typecheck` passed in `C:\Users\HP\skill-rooms-api` after adding the native evidence upload session API.
- `npm run typecheck` passed in `C:\Users\HP\sr-mobile` after wiring native proof/media upload.
- `npm run typecheck` passed in `C:\Users\HP\skill-rooms-api` after moving chat attachment binary storage/access into the API.
- `npm run typecheck` passed in `C:\Users\HP\sr-mobile` after wiring native chat attachment upload/download.
- `npm run typecheck` passed in `C:\Users\HP\skill-rooms-api` after making streaming OAuth mobile redirect-aware.
- `npm run typecheck` passed in `C:\Users\HP\sr-mobile` after wiring native streaming OAuth with Expo AuthSession.
- `npm run typecheck` passed in `C:\Users\HP\skill-rooms-web` after adding the mobile streaming OAuth bridge callback.
- `npm run typecheck` passed again in `C:\Users\HP\sr-mobile` after switching native streaming OAuth to the HTTPS bridge callback.
- `npm run typecheck` passed in `C:\Users\HP\skill-rooms-api` after adding mobile push devices, push outbox, Expo delivery, and worker startup.
- `npm run typecheck` passed again in `C:\Users\HP\sr-mobile` after adding Expo notification registration and tap handling.
- `npm run db:migrate` passed in `C:\Users\HP\skill-rooms-api` and applied `049_mobile_push_devices.sql`.
- `npm run db:verify` passed in `C:\Users\HP\skill-rooms-api` after confirming `mobile_push_devices` and `mobile_push_outbox`.
- `npm run typecheck` passed again in `C:\Users\HP\sr-mobile` after adding `react-native-webview`, native embedded stream players, and SDK 55 package realignment.
- `npm run typecheck` passed in `C:\Users\HP\skill-rooms-api` after moving evidence upload sessions, finalized evidence, metadata sidecars, and chat media onto the shared object storage provider.
- `npm run typecheck` passed again in `C:\Users\HP\sr-mobile` after adding `react-native-sse` and wiring native SSE live updates.
- `npm run typecheck` passed in both `C:\Users\HP\sr-mobile` and `C:\Users\HP\skill-rooms-api` after repairing auth parity for email/username login, native Google sign-in client IDs, password visibility, and real register payloads.

## Current Mobile Files

Implemented route shells:

- `app/_layout.tsx`
- `app/index.tsx`
- `app/(auth)/login.tsx`
- `app/(auth)/register.tsx`
- `app/(auth)/forgot-password.tsx`
- `app/(app)/(tabs)/chat.tsx`
- `app/(app)/(tabs)/rooms.tsx`
- `app/(app)/(tabs)/tournaments.tsx`
- `app/(app)/(tabs)/wallet.tsx`
- `app/(app)/(tabs)/profile.tsx`
- `app/(app)/rooms/new.tsx`
- `app/(app)/rooms/join.tsx`
- `app/(app)/rooms/[matchId].tsx`
- `app/(app)/chat/[channelId].tsx`
- `app/(app)/chat/dm-requests.tsx`
- `app/(app)/tournaments/[tournamentId].tsx`

Implemented foundation modules:

- `src/api/client.ts`
- `src/api/errors.ts`
- `src/api/session.ts`
- `src/api/auth.ts`
- `src/api/rooms.ts`
- `src/api/wallet.ts`
- `src/api/tournaments.ts`
- `src/api/profile.ts`
- `src/api/streaming.ts`
- `src/api/chat.ts`
- `src/api/notifications.ts`
- `src/api/realtime.ts`
- `src/api/uploads.ts`
- `src/features/uploads/components/EvidenceUploadField.tsx`
- `src/features/streaming/components/StreamCards.tsx`
- `src/providers/LiveUpdatesProvider.tsx`
- `src/providers/PushNotificationsProvider.tsx`
- `src/features/notifications/pushRegistration.ts`
- `src/store/auth-store.ts`
- `src/providers/AppProviders.tsx`
- `src/providers/query-client.ts`
- Shared UI primitives under `src/components`

## What Is Real Today

- The project structure is usable.
- Login, register, forgot password, session restore, route protection, and logout now have hardened native flows.
- Auth errors show inline in plain English instead of hidden modal-only feedback.
- Login now sends the same `identifier` payload as web, so users can sign in with email or username.
- Login now has native Google sign-in entry and password visibility controls.
- Register handles email-verification-style responses that do not return tokens.
- Register now asks for username, email, password, and password confirmation to match the API and web contract.
- Session bootstrap shows a retryable API-unavailable state instead of signing users out on network failure.
- Invalid refresh tokens clear stored tokens and return the app to auth cleanly.
- Logout clears SecureStore-backed tokens and TanStack Query cache.
- Auth and app route groups use the same bootstrap guard to avoid flashing the wrong routes.
- Forms are wrapped in a keyboard-safe screen layout.
- Profile tab is now a native setup cockpit, not only a web handoff.
- Profile details can be edited natively: display name, username, region, city, campus, timezone, bio, visibility, and age confirmation.
- Readiness card explains what blocks room/tournament readiness in plain player language.
- Primary game account can be created and saved natively.
- Payout details can be saved natively for future winnings.
- Manual YouTube/Twitch stream channels can be saved natively, and YouTube/Twitch OAuth can now be started natively through an HTTPS bridge callback that returns to the app scheme.
- Rooms tab now has native lobby queues for Open, Awaiting Funding, Funding Review, Live, and Done.
- Create Room is a native drill-in screen with game, ruleset, entry amount, title, and profile readiness checks before submit.
- Join By Code is a native drill-in screen with profile readiness checks and clear inline feedback.
- Room create/join still calls the server as final authority; the client only prevents obvious incomplete-profile attempts before submission.
- Room create/join success invalidates the room lobby query so fresh data appears after refresh.
- Room lobby rows now open a native room detail screen.
- Native room detail has Overview, Players, Funding, Live, Result, and History sections.
- Room detail uses the timeline endpoint for room state and participants, plus separate funding, result, and livestream endpoints.
- Current-step card shows the next player action near the top of the screen.
- Funding section supports Skillsroom Balance payment and native manual transfer proof upload.
- Live section displays room stream links when attached and clearly separates missing room streams from saved profile channels.
- Result section supports winner/result submission with uploaded screenshot/video, link, or note evidence and opponent agree/dispute responses.
- Room detail has a visible manual refresh fallback for delayed funding/result decisions.
- Wallet tab now has native Overview, Top-up, Payout, and History views.
- Wallet overview separates available, locked, winnings, and pending top-up money.
- Wallet top-up can be submitted natively with official collection details and uploaded payment proof.
- Pending top-ups are shown as pending and are never added to spendable balance on the client.
- Payout requests can be submitted natively from winnings only.
- Wallet history shows top-ups, payout requests, and ledger entries with plain status states.
- Chat tab now has a native channel/DM lobby instead of only channel discovery.
- Global Chat opens as a first-class native thread.
- DM channels are first-class and separated from public/community channels.
- DM requests can be created by username, accepted, declined, and opened from native screens.
- Chat thread uses a keyboard-safe fixed composer under a scrollable message area.
- Messages still use focused polling for thread freshness, while app-level live events and push notifications now trigger broader query refresh.
- Message send, read marking, and reaction toggles call the server directly.
- Message bubbles render text, replies, reactions, and attachment metadata without letting media push the composer off-screen.
- Chat attachments can now be picked, uploaded, sent, and opened natively with explicit tap-to-open behavior.
- Tournaments tab now has a native event list that opens native tournament detail.
- Tournament detail has Overview, Entry, Bracket, Standings, and Streams sections.
- Registration uses the server tournament register endpoint and keeps team names only where team events need them.
- Paid and hybrid entries can be funded from Skillsroom Balance, with the server as final authority.
- Manual tournament entry proof can be submitted natively with official collection details and uploaded payment proof.
- Tournament check-in calls the server check-in endpoint and only appears as available in the player-safe check-in window.
- Bracket/matches and standings are read-only native views based on server tournament structure and approved results.
- Tournament official streams render natively as openable stream rows.
- Shared native stream cards now clarify saved profile channels versus room/tournament watch links.
- Room stream cards now use provider-aware watch rows with clear live/replay/offline states.
- Tournament stream cards now use the same native watch rows.
- Eligible room creators/operators can attach YouTube/Twitch/TikTok stream links natively.
- Eligible tournament creators/hosts/operators can attach YouTube/Twitch/TikTok stream links natively.
- View-only users see a clear message when they cannot attach streams.
- Saved profile stream channels can be opened, live video links can be opened when present, and live status can be refreshed.
- Room, tournament, and profile live stream cards can load embedded WebView players for YouTube, Twitch, and TikTok links when the provider supplies or allows an embed URL.
- Stream cards still keep external open as the fallback when a provider blocks embedded playback or a link is not embeddable.
- Native proof/media upload now uses a mobile-safe API upload session flow, server-side file signature validation, hardened evidence URLs, and shared upload UI.
- A root live-update provider now listens for realtime events when an EventSource implementation is available.
- The live-update provider falls back to polling unread in-app notifications on native runtimes without EventSource.
- Important updates show plain in-app toast cards.
- Live update events invalidate room, wallet, tournament, chat, and stream query buckets.
- Native push registration now requests OS permission, stores the Expo token on the API, unregisters before sign-out, and routes notification taps to native room, tournament, chat, wallet, or profile screens where possible.
- The API now stores mobile push devices separately from web push subscriptions and uses a retryable mobile push outbox for notification delivery.
- Expo push payloads use generic text plus `notification_id` and minimal routing hints; full notification details stay behind the authenticated Skillsroom API.
- Room detail now refreshes timeline, funding, result, and livestream state on intervals.
- Wallet overview now refreshes on an interval so top-up approvals and payout changes appear without manual reload.
- Chat thread polling interval is tightened for message/reaction updates.
- The five player tabs match the web player nav.
- The code is typechecked.

## What Is Not Done Yet

These are not bugs; they are unfinished phases:

- Real-device Android push delivery QA has not been completed.
- Android device QA has not been completed.

## Phase 1A Acceptance Status

- Fresh install opens auth when signed out: implemented through route guards.
- Login persists across app restart: implemented through SecureStore session bootstrap.
- Expired access token refreshes silently: implemented in the API client refresh path.
- Invalid refresh token signs out cleanly: implemented through auth failure handling and token clearing.
- Register tells users to verify email where applicable: implemented when registration succeeds without returned tokens.
- All auth errors appear without scrolling: implemented with inline form notices above submit buttons.

## Phase 2 Acceptance Status

- User knows exactly why they cannot create/join money rooms: implemented through the Readiness card and missing setup messages.
- Primary game account can be created and selected: implemented as a native primary account save against the API.
- Payout details are saved for future winnings: implemented through the native payout details form.
- Profile screen does not use admin/developer language: implemented with player-facing labels and no raw internal status wording.

Phase 2 intentional deferral:

- Streaming OAuth is now native through an HTTPS bridge callback that redirects back to `skillsroom://oauth/streaming`. Manual stream channel save remains available as fallback.

## Phase 3 Acceptance Status

- User can create a room after profile/game-account setup: implemented through native create flow with server-backed readiness check.
- User can join another room by code: implemented through native join flow with server-backed readiness check.
- Room appears in the correct queue after refresh: implemented by invalidating the room lobby query after create/join and mapping server statuses into player-facing queues.
- If setup is incomplete, the screen says exactly what to fix and links to Profile: implemented on both create and join screens.

Phase 3 intentional boundary:

- Phase 3 originally stopped at room queues, create room, and join by code. Native room detail is now covered by Phase 4.
- The Done queue depends on rooms returned by the current lobby API. Historical wallet-style settlement lists stay for later phases.

## Phase 4 Acceptance Status

- On a phone, user sees the next action without hunting: implemented through the top current-step card.
- Funding proof cannot falsely mark Play/Evidence complete: implemented by showing submitted proof as review-only until server funding status changes.
- Live section is responsive and never overflows horizontally: implemented as stacked stream rows with external open actions.
- Admin decisions update through refresh/live update path: implemented with visible manual refresh and query invalidation after player actions; push/live automation remains Phase 9.
- Manual refresh fallback is visible if live updates delay: implemented through the Refresh room action near the top of room detail.

Phase 4 boundary closure:

- Native file upload for funding proof and result evidence is now implemented through the shared evidence upload API and mobile picker/upload UI.
- Full native embedded video playback is now covered by the Phase 8 streaming boundary closure.
- Room detail is now native, but deeper standalone routes like `rooms/[matchId]/funding`, `rooms/[matchId]/live`, and `rooms/[matchId]/result` remain optional refinements.

## Phase 5 Acceptance Status

- Pending top-ups are never shown as spendable: implemented by showing pending top-ups in a separate bucket from available balance.
- Approved top-up updates available balance after server approval: implemented by rendering server wallet overview only; the client never increments balance locally.
- Payout requests use winnings only: implemented with native winnings-balance validation before payout request and server-side payout API enforcement.
- User can understand exactly where money is: implemented with Available, Locked, Winnings, Pending, Top-ups, Payout requests, and Ledger sections.

Phase 5 boundary closure:

- Native wallet top-up proof upload is now implemented. The API owns `/evidence/uploads`, `/evidence/uploads/:uploadId/content`, and `/evidence/uploads/:uploadId/complete`; mobile uploads screenshots/videos and receives a hardened `/api/evidence-files/...` URL for the existing wallet proof field.
- Wallet top-ups and payout requests refresh wallet state after server acceptance, but push/live approval notifications remain Phase 9.

## Phase 6 Acceptance Status

- Composer never disappears after media load: implemented by keeping the composer outside the message scroll area and rendering attachments as bounded manual-load rows.
- Sender sees their own uploaded media correctly: implemented for attachments returned by the server in message payloads; native binary upload remains deferred until mobile has a real upload/download signing path.
- Receiver rules still respect manual load/download behavior: implemented by requiring a tap before attachment access metadata is requested.
- DM is first-class, not a generic channel loading state: implemented through a dedicated DM tab, DM request manager, and DM thread routing.

Phase 6 boundary closure:

- Native chat binary upload/download is now implemented through the API. Mobile reserves an attachment, uploads raw binary content, sends ready attachment IDs with the message, requests signed access URLs, and opens attachments only after a user tap.
- Realtime chat is polling-based for now. Phase 9 should replace or supplement this with the app-wide live update/push path.

## Phase 7 Acceptance Status

- User can discover tournaments: implemented through the native tournaments list with event status, entry count, entry fee, prize pool, and start time.
- User can enter with balance/manual option: implemented through native registration, Skillsroom Balance entry funding, and manual proof-link submission for paid/hybrid entries.
- Tournament entry state is clear: implemented through the current entry card, funding state, check-in state, entrants list, and manual refresh/polling.
- No admin words like seed IDs or internal audit language leak to players: implemented by keeping host/admin operations out of mobile and using player labels for bracket, standings, funding, and check-in.

Phase 7 boundary closure:

- Native tournament proof upload now uses the shared evidence upload API and passes the returned hardened evidence URL into the existing tournament contribution endpoint.
- Bracket and standings are read-only for players. Tournament seeding, structure generation, result review, settlements, and host controls remain web/admin-owned for v1.
- Tournament live updates now use Phase 9 realtime/push invalidation plus polling/manual refresh as fallback.

## Native Proof/Media Upload Boundary Status

Closed for wallet top-ups, room funding proof, room result screenshot/video evidence, and tournament entry proof.

What changed:

- API now has authenticated upload sessions under `/evidence/uploads`.
- Upload content is sent as raw `application/octet-stream`, not JSON/base64.
- The server validates allowed MIME types, max file size, and file magic bytes before finalizing.
- Finalized files use the existing hardened evidence file name format accepted by API validators.
- Metadata sidecars are written in the same shape the web evidence reader expects.
- Mobile uses `expo-image-picker`, `expo-document-picker`, and `expo-file-system` through a shared `EvidenceUploadField`.

Deployment note:

- API and web can still use `EVIDENCE_STORAGE_PROVIDER=local` for localhost development, but production should configure both apps with the same `EVIDENCE_STORAGE_PROVIDER`, bucket, endpoint, and prefix.
- `s3_compatible` supports AWS S3, MinIO, and Supabase S3-compatible storage. `cloudflare_r2` supports Cloudflare R2.
- API upload sessions now also live in the shared provider under the provider upload area, so a multi-instance API deployment no longer depends on one machine receiving both upload and complete requests.

## Native Chat Attachment Upload/Download Boundary Status

Closed for chat images and supported documents.

What changed:

- API now owns chat attachment binary storage for mobile-safe upload.
- Mobile reserves attachments through the existing chat attachment API, uploads raw `application/octet-stream`, and sends ready attachment IDs with the message.
- The server validates JPG, PNG, WEBP, PDF, DOC, DOCX, ODT, and TXT content by MIME type, size, and file signature before completing the attachment record.
- Attachment access now returns a short-lived signed media URL from the API.
- Mobile opens attachments only after an explicit tap, preserving the manual-load safety rule.

Deployment note:

- Chat media now uses the same shared object storage provider as hardened evidence files. API and web must use matching object storage settings in production so mobile-uploaded chat attachments and web-uploaded chat attachments resolve from the same durable backend.

## Phase 8 Acceptance Status

- Connected channel and room stream are not confused: implemented with separate connected-profile-channel cards and room/tournament stream link cards.
- No horizontal overflow: implemented through stacked stream cards and wrapped attach controls.
- User understands whether there is no channel, no live video, or no room stream link: implemented through distinct empty states, profile channel copy, playback badges, and provider fallback text.

Phase 8 boundary closure:

- Native embedded YouTube/Twitch/TikTok playback is now implemented with `react-native-webview` through the shared stream card component.
- Stream cards use an explicit Load player action before mounting WebView, maintain a stable 16:9 player box, restrict player navigation to provider domains, and keep Open externally as fallback.
- YouTube watch, short, live, and youtu.be links can be converted into no-cookie embed URLs when the API does not provide `embed_url`.
- Twitch channel/video links can be converted into `player.twitch.tv` embeds with the configured web app host as the parent.
- TikTok video links can be converted into TikTok embed URLs. TikTok live/profile links that are not embeddable still use the external fallback.
- Native streaming OAuth now uses Expo AuthSession, the registered HTTPS mobile bridge callback, and the `skillsroom://oauth/streaming` app callback. Manual YouTube/Twitch profile channel save remains native.
- Stream attachment is server-permissioned. Mobile shows attach controls only where it can infer creator/host/operator access; the API remains final authority.
- Stream live updates now use the Phase 9 in-app realtime/polling fallback, and account-level notifications can reach native push through the shared mobile push path.

Deployment note:

- Real-device QA must confirm WebView playback, fullscreen behavior, orientation handling, and provider blocked-embed fallback on Android.

## Native Streaming OAuth Boundary Status

Closed for YouTube and Twitch OAuth from the mobile Profile screen using the production HTTPS bridge callback.

What changed:

- API OAuth start accepts a per-request `redirect_uri` and stores it with the OAuth state.
- Provider authorization URLs now use the stored redirect URI.
- OAuth completion exchanges the code with the same redirect URI that started the flow.
- Web owns `/api/streaming/oauth/mobile-callback` as a narrow bridge that forwards provider `code`, `state`, and OAuth errors into `skillsroom://oauth/streaming`.
- Mobile sends the HTTPS bridge URI to the API/provider, while `expo-web-browser` waits for the app-scheme callback.
- The Profile screen now has native Connect YouTube and Connect Twitch actions, while manual channel save remains available.

Deployment note:

- YouTube/Twitch provider dashboards must allow the exact production mobile redirect URI, `https://skillsroom.xyz/api/streaming/oauth/mobile-callback`, or the provider will reject the OAuth flow before Skillsroom receives a callback.
- Mobile production builds should set `EXPO_PUBLIC_STREAMING_OAUTH_REDIRECT_URI=https://skillsroom.xyz/api/streaming/oauth/mobile-callback`.
- `STREAMING_TOKEN_ENCRYPTION_KEY`, provider client IDs, and provider client secrets must be configured on the API before OAuth can complete.

## Phase 9 Acceptance Status

- Funding approval changes the funding card: implemented through realtime/notification-triggered invalidation plus room funding interval refresh.
- Result approval changes the result/status card: implemented through realtime/notification-triggered invalidation plus room result/timeline interval refresh.
- Wallet balance refreshes after approval: implemented through notification-triggered wallet invalidation and wallet interval refresh.
- User gets a visible message when something important changes: implemented with root-level in-app toast cards for realtime events and unread notifications.

Phase 9 boundary closure:

- Native push notifications are now implemented through Expo notifications, API-owned device registration, a retryable mobile push outbox, and notification tap routing.
- The API sends generic Expo push text plus `notification_id` and minimal routing hints only; mobile fetches full notification content from the authenticated API.
- Server-Sent Events now use a React Native SSE client with authenticated headers, custom `realtime-event` handling, automatic reconnect, and `Last-Event-ID` support from the SSE client.
- Native devices still keep unread-notification polling and OS push as safety nets when the realtime stream cannot start or reconnect.

Deployment note:

- Production Android push requires EAS/FCM credentials configured for the Expo project before real devices can receive remote notifications.
- If Expo push access-token protection is enabled, set `EXPO_PUSH_ACCESS_TOKEN` on the API.
- Real-device testing must confirm SSE reconnect behavior, permission prompt, push token registration, background delivery, tap routing, stale-token cleanup, and logout unregister behavior.

## API Patch Status

The API trusted-origin middleware was updated so native bearer-token mutating requests can work without browser `Origin` or `Referer` headers.

This is required for Android because native requests are not browser page requests.

## Next Correct Phase

Phase 10: Android QA And Release Hardening.

Recommended next step: real-device Android QA, production environment pass, error reporting plan, and release build readiness.

Before Phase 10, confirm on device:

- Fresh install opens login.
- Login survives closing and reopening the app.
- Logout returns to auth and does not leave old profile/wallet data in cache.
- Offline/API-down bootstrap shows retry instead of signing the user out.
- Profile save, primary game account save, payout save, and manual stream channel save work against the real API.
- Create room succeeds after profile setup and appears in Open.
- Join by code succeeds from a second account and moves the room to Awaiting Funding.
- Room detail opens from the lobby.
- Balance payment locks funds only after server confirmation.
- Manual proof upload shows review state and does not mark funding approved by itself.
- Result submit/respond refreshes the room state after server acceptance.
- Wallet top-up proof upload appears as pending and does not change available balance.
- Approved top-up changes available balance only after server approval and refresh.
- Payout request debits winnings only after server acceptance.
- Tournament list opens detail.
- Tournament registration creates an entry.
- Balance entry funding changes only after server acceptance.
- Manual tournament proof upload appears as pending/review state.
- Check-in succeeds only when the server allows it.
- Connected profile stream channels are not confused with room or tournament stream links.
- Room creators can attach a supported stream link and viewers can open it.
- Tournament hosts can attach a supported stream link and viewers can open it.
- YouTube/Twitch/TikTok stream links load embedded players when embeddable and keep external fallback when blocked.
- In-app live update toasts appear for unread notifications.
- Room funding/result cards update without manual reload after server-side decisions.
- Wallet top-up approval appears without manually restarting the app.

## Do Not Claim Shipped Until

- Phase 1 through Phase 10 acceptance checks pass.
- Two-user room flow works on Android.
- Wallet top-up and room funding work on Android.
- Chat/DM composer works on Android.
- Android release build is tested.
