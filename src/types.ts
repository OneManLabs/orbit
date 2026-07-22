/**
 * Shared TypeScript type definitions
 */

import * as THREE from 'three'

// === 3D Scene Types ===

export interface ModelPart {
  mesh: THREE.Mesh
  name: string
  originalPosition: THREE.Vector3
  originalRotation: THREE.Euler
  originalScale: THREE.Vector3
}

export interface Model {
  object: THREE.Group
  parts: ModelPart[]
  boundingBox: THREE.Box3
}

export interface Transform {
  position: THREE.Vector3
  rotation: THREE.Euler
  scale: THREE.Vector3
}

// === Hand Tracking Types ===

export interface Hand {
  landmarks: THREE.Vector3[]  // 21 landmarks
  handedness: 'Left' | 'Right'
  worldLandmarks: THREE.Vector3[]  // Real-world 3D coords
}

export interface HandFrameData {
  timestamp: number
  hands: Hand[]
  confidence: number
}

export interface HandPose {
  position: THREE.Vector3
  rotation: THREE.Quaternion
  scale: number
  landmarks: THREE.Vector3[]
}

// === Gesture Types ===

export type GestureType =
  | 'NONE'
  | 'HOVER'
  | 'PINCH'
  | 'TWO_HAND_SCALE'
  | 'TWO_HAND_TRANSLATE'

export interface GestureResult {
  type: GestureType
  confidence: number
  metadata?: Record<string, any>
}

// === State Machine Types ===

export type State =
  | 'IDLE'
  | 'HOVER'
  | 'GRAB'
  | 'MANIPULATE'
  | 'RELEASE'

export interface StateTransition {
  previousState: State
  currentState: State
  transitioned: boolean
  metadata?: Record<string, any>
}

// === Transform Delta ===

export interface TransformDelta {
  position: THREE.Vector3
  rotation: THREE.Quaternion
  scale: number
}

// === Raycasting ===

export interface RaycastHit {
  object: THREE.Object3D
  distance: number
  point: THREE.Vector3
  face: THREE.Face | null
}

// === Performance Metrics ===

export interface PerformanceMetrics {
  fps: number
  frameTime: number
  memory: number
}
