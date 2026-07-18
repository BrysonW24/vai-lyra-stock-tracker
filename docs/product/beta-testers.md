# Lyra iOS Beta - Tester Guide

Welcome, and thanks for testing.

## Welcome

Lyra is a research-first stock momentum radar. It watches the market on an hourly cadence,
scores beaten-down stocks that are showing an early recovery turn, and explains what it sees
in plain English - a deterministic engine owns every number, the AI only phrases it. As a
beta tester you get the iOS app before anyone else, and your job is simple: use it like you
would a real app, and tell us where it breaks, confuses, or annoys you. Everything in the
app is paper trading - no real money is involved anywhere.

One nice property of this beta: the app loads the live Lyra web app, so it updates itself
with every release. You will almost never need to install an update to see new features.

## Joining the beta

You will receive an email invitation from TestFlight (Apple's official beta testing app).
Here is the full path, assuming a normal iPhone and no technical setup:

1. On your iPhone, open the **App Store** and search for **TestFlight**. Install it - it is
   free and made by Apple. You need it before the invite will work.
2. Open the invitation email **on your iPhone** and tap the button in it (it says
   **View in TestFlight** or **Start Testing**).
3. TestFlight opens. Tap **Accept**, then tap **Install**.
4. Lyra now appears on your home screen like any other app. Open it and you are in.

If the email opened on your computer instead, no problem - it shows a redeem code you can
enter in the TestFlight app on your phone (TestFlight > Redeem).

## What to test first

Try to break it. Seriously - poke at things in the wrong order, tap fast, rotate, go
offline, come back. In rough priority order:

1. **Sign in / create an account.** Does the flow make sense? Did anything stall or loop?
2. **Browse the radar and open a ticker page.** Scroll the lists, tap into a stock, read
   the score breakdown. Anything slow, cut off, or unreadable on your screen size?
3. **Set up an alert.** Pick a stock, configure an alert, and check it saved.
4. **Try the AI chat.** Ask it to explain a stock's score or compare two names. Flag
   anything that reads as wrong, vague, or overconfident.
5. **Share a ticker.** Use the share option on a ticker page and see where the link lands
   for the person receiving it.

## Known limitations

Honest list - these are real, known, and on the roadmap where noted:

- **Push notifications do not work inside the iOS app yet.** Native Apple push is coming in
  a later phase. Today, push notifications DO work on the website and on the home-screen
  web app (visiting lyra.vivacityai.com.au in Safari and using Add to Home Screen) - so if
  alerts on your phone matter to you now, that is the path.
- **Paper trading only.** There is no real money anywhere in Lyra. It does not connect to
  a broker, hold funds, or place trades - and it never will in this beta.
- **Market data is hourly, not real-time.** Lyra scans on an hourly cadence. Prices and
  scores are not tick-by-tick live quotes, and some figures may be delayed or sample data.
- **This is research software, not financial advice.** Lyra surfaces stocks worth a closer
  look and explains why. It never tells you to buy or sell, and nothing in it is a
  recommendation or a promise of returns.

## Sending feedback

Two channels, both good:

1. **TestFlight screenshot feedback (best for bugs).** Take a screenshot inside the app
   (side button + volume up), tap the screenshot thumbnail, then choose
   **Share Beta Feedback**. You can draw on the screenshot and add a note - it comes
   straight to us with device details attached.
2. **The in-app feedback widget.** Use the feedback option inside Lyra itself for ideas,
   confusion, or anything that is not screenshot-shaped.

What good feedback looks like - three lines is plenty:

- What you expected to happen.
- What actually happened.
- A screenshot if you have one.

"The alert page felt confusing" is useful. "I tapped Save on a new alert, nothing happened,
screenshot attached" is gold.

Thanks for helping make Lyra better.

---

Lyra is research and educational software, not financial, investment, or trading advice -
see the full disclaimer in the app and in the project's DISCLAIMER file; all decisions and
risk are yours.
