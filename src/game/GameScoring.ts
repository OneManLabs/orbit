/**
 * GameScoring - Validation and scoring logic for training game
 */

import { CONFIG } from '../config'
import type { GameShape, GameTarget, PlacementValidation, ScoreResult } from './GameState'

export class GameScoring {
  /**
   * Validate if a shape is correctly placed at a target
   */
  static validatePlacement(shape: GameShape, target: GameTarget): PlacementValidation {
    // Check if shape type matches target type
    if (shape.type !== target.type) {
      return {
        valid: false,
        distance: Infinity,
        accuracy: 0
      }
    }

    // Calculate distance between shape and target
    const distance = shape.mesh.position.distanceTo(target.position)

    // Check if within placement threshold
    const valid = distance <= CONFIG.game.scoring.placementThreshold

    // Calculate accuracy score (0-100)
    let accuracy = 0
    if (valid) {
      if (distance <= CONFIG.game.scoring.perfectThreshold) {
        accuracy = 100
      } else {
        // Linear interpolation between perfect and threshold
        const range = CONFIG.game.scoring.placementThreshold - CONFIG.game.scoring.perfectThreshold
        const offset = distance - CONFIG.game.scoring.perfectThreshold
        accuracy = 100 - (offset / range) * 100
        accuracy = Math.max(0, Math.min(100, accuracy))
      }
    }

    return {
      valid,
      distance,
      accuracy
    }
  }

  /**
   * Find the nearest matching target for a shape
   */
  static findNearestTarget(shape: GameShape, targets: GameTarget[]): GameTarget | null {
    let nearest: GameTarget | null = null
    let minDistance = Infinity

    for (const target of targets) {
      // Only consider targets of matching type that aren't occupied
      if (target.type === shape.type && !target.occupied) {
        const distance = shape.mesh.position.distanceTo(target.position)
        if (distance < minDistance) {
          minDistance = distance
          nearest = target
        }
      }
    }

    return nearest
  }

  /**
   * Calculate score for a successful placement
   */
  static calculatePlacementScore(
    distance: number,
    accuracy: number,
    timeElapsed: number,
    levelMultiplier: number
  ): ScoreResult {
    // Base score
    const baseScore = CONFIG.game.scoring.basePoints

    // Accuracy bonus (0-50 points based on placement precision)
    const accuracyBonus = Math.floor(
      (accuracy / 100) * CONFIG.game.scoring.maxAccuracyBonus
    )

    // Time bonus (optional, not currently used)
    const timeBonus = 0

    // Calculate total with level multiplier
    const subtotal = baseScore + accuracyBonus + timeBonus
    const totalScore = Math.floor(subtotal * levelMultiplier)

    return {
      baseScore,
      accuracyBonus,
      timeBonus,
      totalScore
    }
  }

  /**
   * Check if all shapes in level are placed
   */
  static isLevelComplete(shapes: GameShape[]): boolean {
    return shapes.every(shape => shape.isPlaced)
  }

  /**
   * Calculate overall accuracy percentage for the level
   */
  static calculateLevelAccuracy(shapes: GameShape[]): number {
    if (shapes.length === 0) return 0

    const placedShapes = shapes.filter(s => s.isPlaced)
    if (placedShapes.length === 0) return 0

    // For now, return 100% if all placed (can be enhanced with distance tracking)
    return (placedShapes.length / shapes.length) * 100
  }
}
