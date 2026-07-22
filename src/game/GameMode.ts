/**
 * GameMode - Main orchestrator for training game
 */

import * as THREE from 'three'
import { CONFIG } from '../config'
import type {
  HandFrameData,
  GestureResult,
  StateTransition,
  Hand
} from '../types'
import { SceneManager } from '../scene/SceneManager'
import { InteractionEngine } from '../core/InteractionEngine'
import {
  GameState,
  ShapeType,
  GameShape,
  GameTarget,
  LevelConfig,
  GameScore
} from './GameState'
import { ShapeGenerator } from './ShapeGenerator'
import { TargetGenerator } from './TargetGenerator'
import { GameScoring } from './GameScoring'
import { GameUI } from './GameUI'

export class GameMode {
  private sceneManager: SceneManager
  private interactionEngine: InteractionEngine

  private state: GameState = GameState.NOT_STARTED
  private currentLevel: number = 0
  private score: GameScore = {
    totalScore: 0,
    currentLevel: 0,
    shapesPlaced: 0,
    accuracy: 0,
    timeBonus: 0
  }

  private shapes: GameShape[] = []
  private targets: GameTarget[] = []
  private grabbedShape: GameShape | null = null
  private nearestTarget: GameTarget | null = null
  private levelStartTime: number = 0
  private levelCompleteTimer: number | null = null
  private grabStartTime: number = 0  // Track when grab started
  private readonly MIN_GRAB_DURATION_MS = 200  // Minimum time to hold before release

  constructor(sceneManager: SceneManager, interactionEngine: InteractionEngine) {
    this.sceneManager = sceneManager
    this.interactionEngine = interactionEngine
  }

  /**
   * Start the game
   */
  startGame(): void {
    console.log('[GameMode] Starting game')

    // Reset score
    this.score = {
      totalScore: 0,
      currentLevel: 0,
      shapesPlaced: 0,
      accuracy: 0,
      timeBonus: 0
    }

    // Load first level
    this.loadLevel(CONFIG.game.levels.startingLevel)

    // Set state to playing
    this.state = GameState.PLAYING

    console.log('[GameMode] Game started')
  }

  /**
   * Pause the game
   */
  pauseGame(): void {
    if (this.state === GameState.PLAYING) {
      this.state = GameState.PAUSED
      console.log('[GameMode] Game paused')
    }
  }

  /**
   * Resume the game
   */
  resumeGame(): void {
    if (this.state === GameState.PAUSED) {
      this.state = GameState.PLAYING
      console.log('[GameMode] Game resumed')
    }
  }

  /**
   * End the game
   */
  endGame(): void {
    console.log('[GameMode] Ending game')

    // Clear level
    this.clearLevel()

    // Reset state
    this.state = GameState.NOT_STARTED
    this.currentLevel = 0

    console.log('[GameMode] Game ended')
  }

  /**
   * Load a specific level
   */
  loadLevel(levelNumber: number): void {
    console.log(`[GameMode] Loading level ${levelNumber}`)

    // Clear previous level
    this.clearLevel()

    // Get level configuration
    const levelConfig = this.getLevelConfig(levelNumber)

    // Create shapes for this level
    this.shapes = ShapeGenerator.createLevelShapes(levelConfig)

    // Create targets for shapes
    this.targets = TargetGenerator.createLevelTargets(this.shapes, levelConfig)

    // Add shapes and targets to scene
    this.shapes.forEach(shape => {
      this.sceneManager.getScene().add(shape.mesh)
    })

    this.targets.forEach(target => {
      this.sceneManager.getScene().add(target.mesh)
    })

    // Update state
    this.currentLevel = levelNumber
    this.score.currentLevel = levelNumber
    this.levelStartTime = Date.now()

    // Update UI
    GameUI.updateLevel(levelNumber)
    GameUI.updateShapesRemaining(this.shapes.length)
    GameUI.showLevelStart(levelNumber)

    console.log(`[GameMode] Level ${levelNumber} loaded with ${this.shapes.length} shapes`)
  }

  /**
   * Get level configuration
   */
  private getLevelConfig(level: number): LevelConfig {
    // Determine shape count - faster progression, no cap
    // Level 1: 1, Level 2: 3, Level 3: 5, Level 4: 7, Level 5: 9, etc.
    const shapeCount = 1 + (level - 1) * 2

    // Determine which shape types to use
    let shapeTypes: ShapeType[]
    if (level === 1) {
      shapeTypes = [ShapeType.CUBE]
    } else if (level === 2) {
      shapeTypes = [ShapeType.CUBE, ShapeType.SPHERE]
    } else {
      shapeTypes = [ShapeType.CUBE, ShapeType.SPHERE, ShapeType.CYLINDER]
    }

    // Calculate target distance (increases faster with level)
    const targetDistance = 1.5 + (level - 1) * 0.5

    return {
      level,
      shapeCount,
      shapeTypes,
      targetDistance,
      targetSize: 1.0
    }
  }

  /**
   * Update game state (called every frame)
   */
  update(
    frameData: HandFrameData,
    gesture: GestureResult,
    transition: StateTransition
  ): void {
    // Don't update if not playing
    if (this.state !== GameState.PLAYING) {
      return
    }

    // Update target pulsing animations
    const deltaTime = 0.016  // Approximate 60fps
    this.targets.forEach(target => {
      TargetGenerator.updatePulse(target, deltaTime)
    })

    // Handle state transitions
    if (transition.transitioned) {
      this.handleStateTransition(transition, frameData, gesture)
    }

    // Check for level completion
    if (this.levelCompleteTimer === null && GameScoring.isLevelComplete(this.shapes)) {
      this.handleLevelComplete()
    }
  }

  /**
   * Handle state transitions from gesture recognition
   */
  private handleStateTransition(
    transition: StateTransition,
    frameData: HandFrameData,
    gesture: GestureResult
  ): void {
    const { previousState, currentState } = transition

    if (currentState === 'GRAB') {
      console.log(`[GameMode] GRAB detected, gesture type: ${gesture.type}`)

      // Only grab if we don't already have a grabbed shape (prevents re-grabbing on flicker)
      if (!this.grabbedShape) {
        // For training game: just grab the first unplaced shape (simpler than raycasting)
        const availableShape = this.shapes.find(s => !s.isPlaced)

        if (availableShape) {
          this.grabbedShape = availableShape
          this.grabStartTime = Date.now()  // Record when grab started

          // Set this shape's model as the active model so InteractionEngine can manipulate it
          this.sceneManager.addModel(availableShape.model!)
          console.log(`[GameMode] ✓ Grabbed shape ${availableShape.type}`)

          this.nearestTarget = GameScoring.findNearestTarget(this.grabbedShape, this.targets)
          if (this.nearestTarget) {
            TargetGenerator.highlightTarget(this.nearestTarget, true)
            console.log('[GameMode] ✓ Highlighting matching target')
          }
        } else {
          console.log('[GameMode] ✗ No unplaced shapes available')
        }
      } else {
        console.log(`[GameMode] Already holding ${this.grabbedShape.type}, ignoring re-grab`)
      }
    }

    if (currentState === 'RELEASE' && previousState !== 'IDLE') {
      // Only release if we've been holding for minimum duration (prevents accidental releases)
      const holdDuration = Date.now() - this.grabStartTime

      if (holdDuration < this.MIN_GRAB_DURATION_MS) {
        console.log(`[GameMode] Ignoring release - held for only ${holdDuration}ms (min: ${this.MIN_GRAB_DURATION_MS}ms)`)
        return
      }

      // Shape released - check placement
      if (this.grabbedShape && !this.grabbedShape.isPlaced) {
        this.checkPlacement(this.grabbedShape)
      }

      // Clear highlights
      if (this.nearestTarget) {
        TargetGenerator.highlightTarget(this.nearestTarget, false)
      }

      this.grabbedShape = null
      this.nearestTarget = null
      this.grabStartTime = 0
    }
  }

  /**
   * Raycast from hand position to find which shape is being grabbed
   */
  private raycastForShapeFromHand(hand: Hand): GameShape | null {
    const indexTip = hand.landmarks[8]  // Index finger tip

    // Convert normalized coordinates to NDC (Normalized Device Coordinates)
    const ndcX = (indexTip.x * 2) - 1
    const ndcY = -(indexTip.y * 2) + 1  // Y is inverted

    // Create raycaster
    const raycaster = new THREE.Raycaster()
    raycaster.setFromCamera(new THREE.Vector2(ndcX, ndcY), this.sceneManager.getCamera())

    console.log(`[GameMode] Raycasting from NDC: (${ndcX.toFixed(2)}, ${ndcY.toFixed(2)})`)

    // Raycast against all shapes that haven't been placed
    const meshes = this.shapes
      .filter(shape => !shape.isPlaced)
      .map(shape => shape.mesh)

    if (meshes.length === 0) {
      console.log('[GameMode] No unplaced shapes to raycast against')
      return null
    }

    // Log shape positions for debugging
    console.log(`[GameMode] Shape positions:`)
    this.shapes.forEach((shape, i) => {
      if (!shape.isPlaced) {
        const pos = shape.mesh.position
        console.log(`  Shape ${i} (${shape.type}): (${pos.x.toFixed(2)}, ${pos.y.toFixed(2)}, ${pos.z.toFixed(2)})`)
      }
    })

    const intersects = raycaster.intersectObjects(meshes, false)

    console.log(`[GameMode] Intersects found: ${intersects.length}`)
    if (intersects.length > 0) {
      const hitMesh = intersects[0].object as THREE.Mesh
      const shape = this.findShapeByMesh(hitMesh)
      const distance = intersects[0].distance
      console.log(`[GameMode] ✓ Raycast HIT shape: ${shape?.type} at distance ${distance.toFixed(2)}`)
      return shape
    }

    console.log('[GameMode] ✗ Raycast missed all shapes - try pointing at the cube')
    return null
  }

  /**
   * Find a shape by its mesh
   */
  private findShapeByMesh(mesh: THREE.Mesh): GameShape | null {
    return this.shapes.find(shape => shape.mesh === mesh) || null
  }

  /**
   * Check if a shape is correctly placed
   */
  private checkPlacement(shape: GameShape): void {
    // Find nearest matching target
    const target = GameScoring.findNearestTarget(shape, this.targets)
    if (!target) {
      console.log('[GameMode] No matching target found')
      return
    }

    // Validate placement
    const validation = GameScoring.validatePlacement(shape, target)

    if (validation.valid) {
      // Successful placement!
      console.log(`[GameMode] Successful placement! Distance: ${validation.distance.toFixed(3)}, Accuracy: ${validation.accuracy.toFixed(1)}%`)

      // Snap to target position
      shape.mesh.position.copy(target.position)
      shape.isPlaced = true
      shape.placeTime = Date.now()
      target.occupied = true

      // Calculate score
      const timeElapsed = (Date.now() - this.levelStartTime) / 1000
      const scoreResult = GameScoring.calculatePlacementScore(
        validation.distance,
        validation.accuracy,
        timeElapsed,
        this.currentLevel
      )

      // Update total score
      this.score.totalScore += scoreResult.totalScore
      this.score.shapesPlaced++

      // Update UI
      GameUI.updateScore(this.score)
      GameUI.updateShapesRemaining(this.shapes.filter(s => !s.isPlaced).length)

      console.log(`[GameMode] +${scoreResult.totalScore} points (Base: ${scoreResult.baseScore}, Accuracy: ${scoreResult.accuracyBonus})`)
    } else {
      console.log(`[GameMode] Placement invalid - distance: ${validation.distance.toFixed(3)} (threshold: ${CONFIG.game.scoring.placementThreshold})`)
    }
  }

  /**
   * Handle level completion
   */
  private handleLevelComplete(): void {
    console.log('[GameMode] Level complete!')

    // Calculate level accuracy
    this.score.accuracy = GameScoring.calculateLevelAccuracy(this.shapes)

    // Show completion message
    GameUI.showLevelComplete(this.score.totalScore, this.score.timeBonus)

    // Set state
    this.state = GameState.LEVEL_COMPLETE

    // Auto-advance to next level after delay
    if (CONFIG.game.levels.autoAdvance && this.currentLevel < CONFIG.game.levels.maxLevel) {
      this.levelCompleteTimer = window.setTimeout(() => {
        this.advanceToNextLevel()
      }, CONFIG.game.levels.levelCompleteDelay)
    } else {
      // Game complete!
      this.handleGameComplete()
    }
  }

  /**
   * Advance to next level
   */
  private advanceToNextLevel(): void {
    this.levelCompleteTimer = null
    this.state = GameState.PLAYING
    this.loadLevel(this.currentLevel + 1)
  }

  /**
   * Handle game completion (all levels done)
   */
  private handleGameComplete(): void {
    console.log('[GameMode] Game complete!')
    this.state = GameState.GAME_OVER
    GameUI.showGameComplete(this.score.totalScore)
  }

  /**
   * Clear current level
   */
  private clearLevel(): void {
    // Remove shapes from scene
    this.shapes.forEach(shape => {
      this.sceneManager.getScene().remove(shape.mesh)
      shape.mesh.geometry.dispose()
      if (shape.mesh.material instanceof THREE.Material) {
        shape.mesh.material.dispose()
      }
    })

    // Remove targets from scene
    this.targets.forEach(target => {
      this.sceneManager.getScene().remove(target.mesh)
      target.mesh.geometry.dispose()
      if (target.mesh.material instanceof THREE.Material) {
        target.mesh.material.dispose()
      }
    })

    // Clear arrays
    this.shapes = []
    this.targets = []
    this.grabbedShape = null
    this.nearestTarget = null

    // Clear level complete timer
    if (this.levelCompleteTimer !== null) {
      clearTimeout(this.levelCompleteTimer)
      this.levelCompleteTimer = null
    }
  }

  /**
   * Check if game is paused
   */
  isPaused(): boolean {
    return this.state === GameState.PAUSED
  }

  /**
   * Get current game state
   */
  getState(): GameState {
    return this.state
  }

  /**
   * Get current score
   */
  getScore(): GameScore {
    return { ...this.score }
  }
}
