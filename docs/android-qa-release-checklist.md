# Android QA Checklist

## Local Device

- API running locally on port `4100`.
- Web running locally on port `3100` when using web handoffs.
- `.env` points to emulator `10.0.2.2` or physical device uses `adb reverse`.
- Sign in succeeds.
- Refresh app and session survives.
- Sign out clears the session.

## Player Flow

- Rooms tab loads without freezing.
- Join code handles invalid codes with a clear message.
- Create room shows useful profile/game-account errors.
- Wallet loads available and locked balance.
- Profile shows game-account status.
- Tournament list handles empty states.

## Production Readiness

- Use production API URL.
- Confirm API allows bearer-token mobile requests without browser Origin.
- Build preview APK first.
- Test on a real Android phone before EAS production build.
