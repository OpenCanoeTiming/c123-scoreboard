# Deployment with FullPageOS

[FullPageOS](https://github.com/guysoft/FullPageOS) is a lightweight Raspberry Pi OS image that boots straight into a fullscreen Chromium browser — perfect for driving scoreboards, LED walls, and other dedicated displays.

Tested with Raspberry Pi 3 A+ and Raspberry Pi 5 (2 GB RAM).

## Setup

### 1. Build and serve the scoreboard

```bash
npm run build
```

Deploy the `dist/` folder to any web server accessible from the Pi's network.

### 2. Install FullPageOS

Flash [FullPageOS](https://github.com/guysoft/FullPageOS) to an SD card using [Raspberry Pi Imager](https://www.raspberrypi.com/software/) or another tool. Configure Wi-Fi and SSH access during flashing if needed.

### 3. Set the scoreboard URL

Connect to the Pi via SSH:

```bash
ssh pi@[raspberry-pi-ip]
```

Edit the FullPageOS URL file:

```bash
sudo nano /boot/firmware/fullpageos.txt
```

Replace the sample URL with your scoreboard address. Include all URL parameters:

```
http://[webserver]/scoreboard/?server=[c123-server]:27123
```

> **Tip:** This file can also be edited directly on the SD card from your computer, without SSH.

### 4. Reboot

```bash
sudo reboot
```

The scoreboard should now appear on the Pi's HDMI output.

## Optional configuration

### Vertical display orientation

For portrait-mounted displays:

```bash
sudo nano /home/timing/scripts/start_gui
```

Set the `DISPLAY_ORIENTATION` value:

```
DISPLAY_ORIENTATION=left
```

### Low-memory optimization

On RPis with limited RAM (e.g. Pi 3 A+ with 512 MB), Chromium's memory check may prevent the browser from starting:

```bash
sudo nano /home/timing/scripts/start_chromium_browser
```

Add `--no-memcheck` among the flags.

### Custom splash screen

Replace the default FullPageOS splash screen with your own branding:

1. Place your splash image (PNG) on the SD card's boot partition
2. Edit `~/scripts/run_onempageos` on the Pi:
   ```
   feh --bg-center /boot/firmware/your-splash.png
   ```

## LED wall setup

For LED walls driven via a Raspberry Pi, use the [LED wall wrapper](ledwall-wrapper.md) with FullPageOS. Set the URL in `fullpageos.txt` to:

```
http://[webserver]/ledwall.html?width=768&height=384
```

The wrapper renders the scoreboard at the exact pixel dimensions of your LED panel. See [ledwall-wrapper.md](ledwall-wrapper.md) for details on parameters and panel sizes.
