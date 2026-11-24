# Manual device checklist

Run this on real devices for every ticket whose workflow has a "Checked on a real iPhone" step.
Automated e2e runs on an iPhone (WebKit) and an Android (Chromium) profile, but it cannot catch
Home Screen app behavior, real push delivery, or native permission prompts. Those live here.

Check each row on each listed device. Record pass/fail and the device/OS in the PR.

## Devices

- **iPhone Safari** — PeachCourt open in the Safari tab (not installed)
- **iPhone Home Screen app** — PeachCourt added to the Home Screen and opened from there (standalone)
- **Android Chrome** — PeachCourt open in Chrome

## Checklist

| # | Check | iPhone Safari | iPhone Home Screen | Android Chrome |
|---|---|---|---|---|
| 1 | Sign up with email lands on onboarding, then the courts page | | | |
| 2 | Sign in with Google completes and lands in the app | | | |
| 3 | Onboarding step 2: location toggle shows the native permission prompt | | | |
| 4 | Onboarding step 3 matches the device: Safari shows "Add to Home Screen", the Home Screen app and Android show the notifications toggle | | | |
| 5 | Allowing notifications registers a token; a test alert arrives (Home Screen app and Android only) | | | |
| 6 | Denying notifications shows no banner and no inbox entry for that alert type | | | |
| 7 | Map renders with tiles and the "Your location" marker | | | |
| 8 | Check in at a court, confirmation shows, activity updates | | | |
| 9 | Post a game, it appears, the host is in the game chat | | | |
| 10 | Chat input stays above the on-screen keyboard | | | |
| 11 | A failed action shows the "Couldn't … Check your connection and try again." message, never a raw error | | | |
| 12 | Delete account signs out and removes the player's data | | | |

## Notes

- iPhone push only works from the Home Screen app, never from the Safari tab.
- `Notification.requestPermission()` on iPhone only fires from a tap, so trigger it from the toggle, not on load.
