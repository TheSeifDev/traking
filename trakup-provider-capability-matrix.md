# TrackUp Provider Capability Matrix

This matrix reflects the current implementation and the provider contracts inspected on 22 August 2026. It distinguishes **what the current code proves** from what a future provider SDK could make possible.

| Provider | Current position | Current duration | Current play/pause/seek/buffer/end | Current watched ranges | Current heatmap | Metrics allowed now |
| --- | --- | --- | --- | --- | --- | --- |
| `direct_url` | **Yes**, through native HTML5 `video.currentTime` | **Yes**, from the video element or stored video metadata | **Yes** for play, pause, seeked, heartbeat, complete, and ended; buffer events are not currently captured | **Not yet persisted as ranges**; seek origins are now preserved for future reconstruction | **No** | Session count, native-event watch time, and completion may be shown with the native scope label |
| `youtube` | **No in current code**; technically available through the YouTube IFrame Player API | **No in current code**; technically available after SDK integration | **No in current code**; the official API can report playing, paused, buffering, and ended states, but seek and granular polling need integration | **No** | **No** | Session start/end only; do not show playback completion, watch time, drop-off, or heatmap as measured |
| `vimeo` | **No in current code**; technically available through Vimeo Player SDK | **No in current code**; technically available through SDK | **No in current code**; the SDK documents play, pause, seeked, bufferstart, bufferend, ended, progress, and timeupdate | **No** | **No** | Session start/end only; do not show playback completion, watch time, drop-off, or heatmap as measured |
| `google_drive` | **No**; current code uses a plain iframe and Drive REST API is not a preview-player telemetry contract | **No** | **No** | **No** | **No** | Session start/end only |
| `telegram` | **No**; current code uses a plain iframe and the Telegram Bot API does not expose a browser embedded-player telemetry contract | **No** | **No** | **No** | **No** | Session start/end only |

## Current product contract

The public watch page can establish that a TrackUp watch session was created and ended. Only `direct_url` currently has native browser playback events. Even for `direct_url`, the application does not yet persist normalized watched ranges or render a heatmap; the present analytics contract therefore exposes no heatmap claim.

For iframe providers, the UI deliberately reports playback metrics as **Unavailable** or **Not measured**. Implementing YouTube or Vimeo adapters would require a separate design for SDK loading, origin restrictions, event normalization, heartbeat sampling, seek/range reconstruction, duplicate-event handling, and tests. Google Drive and Telegram would require changing the delivery method to a controllable media stream/player or accepting session-only analytics.

## References

1. [YouTube IFrame Player API Reference](https://developers.google.com/youtube/iframe_api_reference) — documents `getCurrentTime()`, `getDuration()`, and player state events.
2. [Vimeo Player SDK Reference](https://developer.vimeo.com/player/sdk/reference) — documents playback methods and events such as `timeupdate`, `seeked`, `bufferstart`, `bufferend`, and `ended`.
3. [Google Drive API REST Reference](https://developers.google.com/workspace/drive/api/reference/rest/v3) — describes Drive resources and file access, not an embedded preview player event API.
4. [Telegram Bot API](https://core.telegram.org/bots/api) — describes the HTTP bot/media interface, not a browser embedded-player telemetry API.
