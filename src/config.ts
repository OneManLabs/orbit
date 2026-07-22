/**
 * Global configuration constants
 * All configurable parameters for the application
 */

export const CONFIG = {
  // === Camera Settings ===
  camera: {
    fov: 45,
    near: 0.1,
    far: 1000,
    position: { x: 0, y: 2, z: 5 },
    lookAt: { x: 0, y: 0, z: 0 }
  },

  // === Rendering Settings ===
  rendering: {
    targetFPS: 60,
    antialias: true,
    alpha: false,
    powerPreference: 'high-performance' as WebGLPowerPreference,
    backgroundColor: 0x0a0e14,
    maxPixelRatio: 2.0
  },

  // === Lighting Settings ===
  lighting: {
    ambient: {
      color: 0x404040,
      intensity: 0.7
    },
    directional: {
      color: 0xffffff,
      intensity: 1.2,
      position: { x: 5, y: 5, z: 5 }
    },
    hemisphere: {
      skyColor: 0xffffff,
      groundColor: 0x444444,
      intensity: 0.8
    }
  },

  // === Model Settings ===
  model: {
    // Drone part dimensions
    body: {
      width: 0.4,
      height: 0.1,
      depth: 0.4,
      color: 0x2a2a2a
    },
    arm: {
      length: 0.6,
      radius: 0.02,
      color: 0x3a3a3a
    },
    motor: {
      radius: 0.08,
      height: 0.06,
      color: 0x1a1a1a
    },
    propeller: {
      radius: 0.15,
      thickness: 0.01,
      color: 0x00d9ff,  // Cyan accent
      bladeCount: 2
    },
    // Part metalness and roughness
    material: {
      metalness: 0.7,
      roughness: 0.3
    }
  },

  // === Hand Tracking Settings ===
  handTracking: {
    numHands: 2,
    minDetectionConfidence: 0.5,
    minTrackingConfidence: 0.5,
    modelComplexity: 1,  // 0 = lite, 1 = full
    camera: {
      width: 640,
      height: 480,
      fps: 30
    }
  },

  // === Smoothing Settings ===
  smoothing: {
    alpha: 0.2,           // EMA factor (lower = more smoothing)
    beta: 0.7,            // One-euro filter speed coefficient
    minCutoff: 1.0,       // One-euro filter minimum cutoff
    confidenceWindow: 5   // Frames to average confidence
  },

  // === State Machine Settings ===
  stateMachine: {
    hoverConfidenceThreshold: 0.6,
    grabConfidenceThreshold: 0.6,  // Increased for more stable grab detection
    releaseConfidenceThreshold: 0.3,  // Lower threshold creates larger hysteresis gap
    stateHysteresisFrames: 5,  // Increased to prevent rapid state changes
    manipulateMovementThreshold: 0.01
  },

  // === Gesture Settings ===
  gestures: {
    pinchDistanceThreshold: 0.06,  // Tighter threshold for more reliable pinch detection
    hoverIndexAngleThreshold: 30,  // Degrees
    twoHandMinSeparation: 0.2      // Normalized distance
  },

  // === Manipulation Settings ===
  manipulation: {
    // Base sensitivity values (reduced for more control)
    rotateSensitivityX: 1.0,  // Reduced from 2.0
    rotateSensitivityY: 1.0,  // Reduced from 2.0
    translateSensitivity: 2.5,  // Reduced from 5.0
    scaleSensitivity: 1.0,  // Added explicit scale sensitivity (was hardcoded at 2.0)

    // Speed multiplier (can be adjusted at runtime)
    speedMultiplier: 1.0,  // Default speed (0.1 = very slow, 2.0 = very fast)

    scaleMin: 0.1,
    scaleMax: 5.0,
    transformSmoothingAlpha: 0.15,
    explodeDistance: 2.0  // Maximum separation distance for explode view
  },

  // === Performance Settings ===
  performance: {
    enableMonitoring: true,
    fpsWarningThreshold: 25,
    logPerformanceMetrics: true,
    performanceCheckInterval: 5000  // ms
  },

  // === Training Game Settings ===
  game: {
    shapes: {
      size: 0.5,  // Larger shapes for easier grabbing
      spawnPosition: { x: 0, y: -1, z: 0 },  // Bottom of screen
      spawnSpacing: 0.8,
      colors: {
        cube: 0xff4757,      // Red
        sphere: 0x1e90ff,    // Blue
        cylinder: 0x2ed573,  // Green
        yellow: 0xffa502,    // Orange-yellow
        purple: 0xa55eea     // Purple
      }
    },
    targets: {
      lineWidth: 3,
      glowIntensity: 0.5,
      pulseSpeed: 2.0,  // Hz
      highlightScale: 1.1
    },
    scoring: {
      basePoints: 100,
      maxAccuracyBonus: 50,
      placementThreshold: 0.3,
      perfectThreshold: 0.1
    },
    levels: {
      startingLevel: 1,
      maxLevel: 20,
      levelCompleteDelay: 2000,  // ms
      autoAdvance: true
    }
  }
} as const

// Export type for configuration
export type Config = typeof CONFIG
