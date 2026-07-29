# store-assets/ - Lyra App Store listing assets

App Store / TestFlight listing collateral: screenshots, preview video, description, keywords, and
review notes. A stable technical folder (not a `lyra-*` operating domain) - see
[`../lyra-folder-convention.md`](../lyra-folder-convention.md).

Distinct from neighbouring folders:

- `store-assets/` (here) - the polished listing assets shipped to Apple.
- [`../testflight/`](../testflight/) - raw TestFlight beta screenshots + install evidence (the
  `lyra-testflight` role; see the convention doc's known-deviations note).
- [`../assets/`](../assets/) - in-app / brand assets used by the product itself.

Expected artifacts (mirrors `vd-mobile-apps/_template/store-assets/`):

- `review-notes.md` - the App Review notes (demo account, research-only framing, what to test).
- `preview-video-notes.md` - the App Preview video shot list / script.
- Screenshot sets per device size, and the finalised description + keyword list.
