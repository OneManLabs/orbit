/**
 * GameState - Types, enums, and state management for training game
 */

import * as THREE from 'three'
import type { Model } from '../types'

/**
 * Game state enum
 */
export enum GameState {
  NOT_STARTED = 'NOT_STARTED',
  PLAYING = 'PLAYING',
  LEVEL_COMPLETE = 'LEVEL_COMPLETE',
  PAUSED = 'PAUSED',
  GAME_OVER = 'GAME_OVER'
}

/**
 * Shape type enum
 */
export enum ShapeType {
  CUBE = 'CUBE',
  SPHERE = 'SPHERE',
  CYLINDER = 'CYLINDER'
}

/**
 * Game shape instance
 */
export interface GameShape {
  mesh: THREE.Mesh
  type: ShapeType
  color: number
  targetPosition: THREE.Vector3
  isPlaced: boolean
  placeTime?: number
  model?: Model  // Temporary model wrapper for InteractionEngine
}

/**
 * Target zone for shape placement
 */
export interface GameTarget {
  mesh: THREE.LineSegments  // Wireframe target outline
  type: ShapeType
  color: number
  position: THREE.Vector3
  occupied: boolean
  originalEmissiveIntensity?: number
  pulsePhase?: number  // For pulsing animation
}

/**
 * Level configuration
 */
export interface LevelConfig {
  level: number
  shapeCount: number
  shapeTypes: ShapeType[]
  targetDistance: number  // How far targets are from spawn
  targetSize: number  // Size multiplier for targets
  timeLimit?: number  // Optional time limit in seconds
}

/**
 * Game score tracking
 */
export interface GameScore {
  totalScore: number
  currentLevel: number
  shapesPlaced: number
  accuracy: number  // 0-100, based on placement precision
  timeBonus: number
}

/**
 * Placement validation result
 */
export interface PlacementValidation {
  valid: boolean
  distance: number
  accuracy: number  // 0-100
}

/**
 * Score calculation result
 */
export interface ScoreResult {
  baseScore: number
  accuracyBonus: number
  timeBonus: number
  totalScore: number
}
