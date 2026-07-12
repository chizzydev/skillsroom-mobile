# New Chat Prompt

Continue Skillsroom Android mobile app work.

Folders:

- Mobile app: `C:\Users\HP\sr-mobile`
- API: `C:\Users\HP\skill-rooms-api`
- Web: `C:\Users\HP\skill-rooms-web`
- Old Decide Mobile reference: `C:\Users\HP\dm`

Important context:

- Do not keep re-reading Decide Mobile for product decisions. Use it only as a process reference.
- The real source of truth is Skillsroom web + Skillsroom API.
- Read these files first:
  - `C:\Users\HP\sr-mobile\docs\implementation-plan.md`
  - `C:\Users\HP\sr-mobile\docs\web-to-mobile-parity.md`
  - `C:\Users\HP\sr-mobile\docs\mobile-architecture.md`
  - `C:\Users\HP\sr-mobile\docs\phase-status.md`
- Current app status is Phase 0 foundation, not full parity.
- Do not push/commit unless explicitly asked.
- Use `apply_patch` for manual edits.

Next exact batch:

```text
Implement Phase 1A: Auth and App Shell Hardening.
```

Phase 1A goals:

- Production-grade login/register/forgot-password.
- Session restore without route flicker.
- Logout clears SecureStore and query cache.
- Access-token refresh works.
- Auth errors are visible immediately on mobile.
- API unavailable state has retry.
- Android keyboard-safe forms.

Verification:

- Run `npm run typecheck` in `C:\Users\HP\sr-mobile`.
- If API code changes, run `npm run typecheck` in `C:\Users\HP\skill-rooms-api`.
- Update `C:\Users\HP\sr-mobile\docs\phase-status.md` after the batch.

Tone/product rule:

Skillsroom is for real players, not developers. User-facing text should be plain English. Avoid words like ops, audit, seed ID, state change, or raw enum labels unless the screen is intentionally operator-only.
