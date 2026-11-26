# GPS Map Camera Pro (React Native)

Professional GPS Map Camera application built with React Native (`react-native` / `react-native-web`) and TypeScript.

## Features
- **HUD System Boot Sequence**: Animated radar calibration splash screen with 4-stage hardware verification.
- **Permissions & Privacy Flow**: Dedicated camera, GPS, and storage permission screen with in-app Privacy Policy viewer.
- **Live Camera Viewfinder**: Front/rear camera switching, torch/flash control, HD (1080p) toggle, tap-to-focus reticle, and simulated viewfinder fallback.
- **Real-Time GPS Telemetry Overlay**: Live latitude/longitude, reverse-geocoded street address with Haversine distance throttling, compass heading, speed, altitude, accuracy indicator, and live clock.
- **Pro Watermark Stamp Renderer**: Generates geotagged field reports with a Google Static Map thumbnail (or offline radar map fallback), address, coordinates, and timestamp.
- **Photo Gallery & Fullscreen Viewer**: Persistent IndexedDB gallery (`GPSCamDB`) with 3-column grid, fullscreen inspection, sharing, and deletion.

## Development
```bash
npm install
npm run dev
```
