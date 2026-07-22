# Setup Reference

Use this reference when the quick procedure in `README.md` does not work.

## Verify the tools

Run these commands:

```bash
node --version
npm --version
```

Use Node.js 20.19 or later.

## Verify the runtime assets

Confirm that these files exist:

```text
public/mediapipe/hands.task
public/mediapipe/wasm/vision_wasm_internal.js
public/mediapipe/wasm/vision_wasm_internal.wasm
public/mediapipe/wasm/vision_wasm_nosimd_internal.js
public/mediapipe/wasm/vision_wasm_nosimd_internal.wasm
```

The repository includes these files. If a file is absent, clone the repository again before you download a replacement.

## Correct a camera-permission problem

1. Open the browser site settings.
2. Allow camera access for the local Orbit address.
3. Close other applications that use the camera.
4. Reload Orbit.

Camera access requires a secure context. A local Vite address meets this requirement in current browsers.

## Correct a WebGL problem

1. Update the browser.
2. Enable hardware acceleration in the browser.
3. Restart the browser.
4. Test Orbit again.

## Correct low frame rate

1. Close other camera applications.
2. Close unused browser tabs.
3. Use a smaller browser window.
4. Disable the debug display.

## Replace the MediaPipe model

Use this procedure only if you must restore the included model:

```bash
curl --fail --location \
  'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task' \
  --output public/mediapipe/hands.task
```

Review the source and license before you replace a runtime asset.
