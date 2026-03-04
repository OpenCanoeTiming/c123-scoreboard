# LED Wall Wrapper

A standalone HTML utility for displaying web content on LED walls with exact pixel dimensions.

## The Problem

LED wall setups typically work like this:

1. A source device (e.g. Raspberry Pi) outputs a standard HDMI signal (e.g. 1920×1080)
2. The LED wall controller card **crops the top-left corner** of the HDMI input — only the area matching the physical panel size is displayed (e.g. 768×384 pixels)
3. The browser on the source device has **no way to detect** the actual LED panel dimensions — it sees the full HDMI resolution as its viewport

This means the scoreboard (or any other content) renders for the full 1920×1080 viewport, but only a small portion is visible on the LED wall.

## The Solution

The LED wall wrapper places content inside an iframe with **exact pixel dimensions** matching the physical LED panel, positioned at coordinates (0,0). The rest of the screen is black. The LED wall controller crops the HDMI signal and gets exactly the right content.

```
┌─────────────────────────────────┐
│ ┌───────────────┐               │
│ │  LED content  │               │
│ │  (iframe)     │   Black       │
│ └───────────────┘               │
│                                 │
│           Black                 │
│                                 │
└─────────────────────────────────┘
  Full HDMI output (e.g. 1920×1080)
```

## Usage

The wrapper is deployed alongside the scoreboard at `/ledwall.html`.

### Basic — Scoreboard

Open in the browser on the source device:

```
http://[server]/ledwall.html?width=768&height=384
```

Without a `url` parameter, the wrapper automatically loads the scoreboard from the same server with `?type=ledwall&displayRows=5`.

### Custom URL — Scoreboard with Parameters

```
http://[server]/ledwall.html?url=http://[server]/?type=ledwall%26displayRows=8%26server=192.168.1.50:27123&width=768&height=384
```

### Custom URL — Other Content (H2R Graphics, etc.)

The wrapper is not scoreboard-specific. Use it with any web content:

```
http://[server]/ledwall.html?url=http://192.168.1.100:8080/output&width=768&height=384
```

This is useful when switching between scoreboard and other content (race info, promotions) using tools like H2R Graphics — all content needs to be wrapped to the correct panel dimensions.

## URL Parameters

| Parameter | Description | Default |
|-----------|-------------|---------|
| `url` | Content URL to display | Scoreboard on same origin |
| `width` | Panel width in pixels | `1280` |
| `height` | Panel height in pixels | `720` |

## Setup with Raspberry Pi (FullPageOS)

1. Build and deploy `dist/` to a web server (or serve locally)
2. Set the URL in `/boot/firmware/fullpageos.txt`:
   ```
   http://[webserver]/ledwall.html?width=768&height=384
   ```
3. Reboot — the browser opens fullscreen, content renders in the top-left corner

## Common Panel Sizes

| Panel | Wrapper URL |
|-------|-------------|
| 768×384 | `?width=768&height=384` |
| 960×320 | `?width=960&height=320` |
| 1280×640 | `?width=1280&height=640` |
| 1920×480 | `?width=1920&height=480` |

Consult your LED wall controller documentation for the exact input resolution it expects.

## Troubleshooting

**Content not visible on LED wall**
- Verify the `width` and `height` parameters match the LED controller's input resolution
- Make sure the HDMI output resolution of the source device is larger than the panel size

**Content loads but looks wrong**
- The scoreboard's `displayRows` parameter controls how many rows are shown — adjust to fit the panel height
- Check that `?type=ledwall` is set on the scoreboard URL

**Cross-origin issues**
- If wrapping content from a different server, ensure it allows iframe embedding (no `X-Frame-Options: DENY`)
