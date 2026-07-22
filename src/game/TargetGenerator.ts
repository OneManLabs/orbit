/**
 * TargetGenerator - Create wireframe target zones for training game
 */

import * as THREE from 'three'
import { CONFIG } from '../config'
import { ShapeType, GameShape, GameTarget, LevelConfig } from './GameState'

export class TargetGenerator {
  /**
   * Create a wireframe target for a cube
   */
  private static createCubeWireframe(color: number): THREE.LineSegments {
    const geometry = new THREE.BoxGeometry(
      CONFIG.game.shapes.size,
      CONFIG.game.shapes.size,
      CONFIG.game.shapes.size
    )

    const edges = new THREE.EdgesGeometry(geometry)
    const material = new THREE.LineBasicMaterial({
      color: color,
      linewidth: CONFIG.game.targets.lineWidth
    })

    return new THREE.LineSegments(edges, material)
  }

  /**
   * Create a wireframe target for a sphere
   */
  private static createSphereWireframe(color: number): THREE.LineSegments {
    const geometry = new THREE.SphereGeometry(
      CONFIG.game.shapes.size / 2,
      16,
      16
    )

    const edges = new THREE.EdgesGeometry(geometry)
    const material = new THREE.LineBasicMaterial({
      color: color,
      linewidth: CONFIG.game.targets.lineWidth
    })

    return new THREE.LineSegments(edges, material)
  }

  /**
   * Create a wireframe target for a cylinder
   */
  private static createCylinderWireframe(color: number): THREE.LineSegments {
    const geometry = new THREE.CylinderGeometry(
      CONFIG.game.shapes.size / 2.5,
      CONFIG.game.shapes.size / 2.5,
      CONFIG.game.shapes.size,
      16
    )

    const edges = new THREE.EdgesGeometry(geometry)
    const material = new THREE.LineBasicMaterial({
      color: color,
      linewidth: CONFIG.game.targets.lineWidth
    })

    return new THREE.LineSegments(edges, material)
  }

  /**
   * Create a wireframe target mesh
   */
  static createWireframeTarget(
    type: ShapeType,
    color: number,
    position: THREE.Vector3
  ): THREE.LineSegments {
    let wireframe: THREE.LineSegments

    switch (type) {
      case ShapeType.CUBE:
        wireframe = this.createCubeWireframe(color)
        break
      case ShapeType.SPHERE:
        wireframe = this.createSphereWireframe(color)
        break
      case ShapeType.CYLINDER:
        wireframe = this.createCylinderWireframe(color)
        break
    }

    wireframe.position.copy(position)
    return wireframe
  }

  /**
   * Create a target zone for a game shape
   */
  static createTargetZone(
    gameShape: GameShape,
    targetPosition: THREE.Vector3
  ): GameTarget {
    const wireframe = this.createWireframeTarget(
      gameShape.type,
      gameShape.color,
      targetPosition
    )

    return {
      mesh: wireframe,
      type: gameShape.type,
      color: gameShape.color,
      position: targetPosition.clone(),
      occupied: false,
      originalEmissiveIntensity: CONFIG.game.targets.glowIntensity,
      pulsePhase: 0
    }
  }

  /**
   * Calculate target positions in a circular pattern
   */
  private static calculateCircularPositions(
    count: number,
    distance: number,
    heightOffset: number = 0
  ): THREE.Vector3[] {
    const positions: THREE.Vector3[] = []
    const angleStep = (Math.PI * 2) / count

    for (let i = 0; i < count; i++) {
      const angle = i * angleStep
      const x = Math.cos(angle) * distance
      const z = Math.sin(angle) * distance
      const y = heightOffset

      positions.push(new THREE.Vector3(x, y, z))
    }

    return positions
  }

  /**
   * Calculate target positions in an arc pattern
   */
  private static calculateArcPositions(
    count: number,
    distance: number,
    heightOffset: number = 0,
    arcAngle: number = Math.PI
  ): THREE.Vector3[] {
    const positions: THREE.Vector3[] = []
    const angleStep = arcAngle / (count - 1)
    const startAngle = -arcAngle / 2

    for (let i = 0; i < count; i++) {
      const angle = startAngle + (i * angleStep)
      const x = Math.cos(angle) * distance
      const z = Math.sin(angle) * distance
      const y = heightOffset

      positions.push(new THREE.Vector3(x, y, z))
    }

    return positions
  }

  /**
   * Calculate target positions in a grid pattern
   */
  private static calculateGridPositions(
    count: number,
    distance: number,
    heightOffset: number = 0
  ): THREE.Vector3[] {
    const positions: THREE.Vector3[] = []
    const cols = Math.ceil(Math.sqrt(count))
    const rows = Math.ceil(count / cols)
    const spacing = distance / cols

    for (let i = 0; i < count; i++) {
      const row = Math.floor(i / cols)
      const col = i % cols
      const x = (col - (cols - 1) / 2) * spacing
      const z = (row - (rows - 1) / 2) * spacing
      const y = heightOffset

      positions.push(new THREE.Vector3(x, y, z))
    }

    return positions
  }

  /**
   * Calculate target positions in a 2D grid pattern (X and Y only, no Z-axis)
   */
  private static calculate2DGridPositions(
    count: number,
    distance: number
  ): THREE.Vector3[] {
    const positions: THREE.Vector3[] = []
    const cols = Math.ceil(Math.sqrt(count))
    const rows = Math.ceil(count / cols)
    const spacingX = distance / Math.max(cols - 1, 1)
    const spacingY = distance / Math.max(rows - 1, 1)

    for (let i = 0; i < count; i++) {
      const row = Math.floor(i / cols)
      const col = i % cols
      const x = (col - (cols - 1) / 2) * spacingX
      const y = (row - (rows - 1) / 2) * spacingY
      const z = 0  // Always 0 - no depth movement

      positions.push(new THREE.Vector3(x, y, z))
    }

    return positions
  }

  /**
   * Create horizontal line positions (for level 2)
   */
  private static createHorizontalLinePositions(
    count: number,
    distance: number
  ): THREE.Vector3[] {
    const positions: THREE.Vector3[] = []
    const spacing = distance / Math.max(count - 1, 1)

    for (let i = 0; i < count; i++) {
      const x = (i - (count - 1) / 2) * spacing
      positions.push(new THREE.Vector3(x, 0, 0))
    }

    return positions
  }

  /**
   * Create scattered 2D positions (for level 3)
   */
  private static createScatteredPositions(
    count: number,
    distance: number
  ): THREE.Vector3[] {
    const positions: THREE.Vector3[] = []

    // Create a nice scattered pattern across X and Y
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2
      const radius = distance * 0.5
      const x = Math.cos(angle) * radius
      const y = Math.sin(angle) * radius * 0.6 // Flatten vertically a bit
      positions.push(new THREE.Vector3(x, y, 0))
    }

    return positions
  }

  /**
   * Create all targets for a level
   */
  static createLevelTargets(
    shapes: GameShape[],
    levelConfig: LevelConfig
  ): GameTarget[] {
    const targets: GameTarget[] = []

    // Determine layout pattern based on level
    let targetPositions: THREE.Vector3[]

    if (levelConfig.level === 1) {
      // Level 1: Single target higher up, clearly separated from spawn
      targetPositions = [new THREE.Vector3(0, 1, 0)]
    } else if (levelConfig.level === 2) {
      // Level 2: Horizontal line pattern
      targetPositions = this.createHorizontalLinePositions(
        levelConfig.shapeCount,
        levelConfig.targetDistance
      )
    } else if (levelConfig.level === 3) {
      // Level 3: Scattered 2D pattern
      targetPositions = this.createScatteredPositions(
        levelConfig.shapeCount,
        levelConfig.targetDistance
      )
    } else {
      // Levels 4+: 2D grid pattern (X and Y only, no Z-axis)
      // All levels use 2D grid - no depth/Z-axis movement
      targetPositions = this.calculate2DGridPositions(
        levelConfig.shapeCount,
        levelConfig.targetDistance
      )
    }

    // Create targets and assign to shapes
    for (let i = 0; i < shapes.length && i < targetPositions.length; i++) {
      const targetPos = targetPositions[i]
      const shape = shapes[i]

      // Update shape's target position
      shape.targetPosition.copy(targetPos)

      // Create target zone
      const target = this.createTargetZone(shape, targetPos)
      targets.push(target)
    }

    return targets
  }

  /**
   * Highlight a target (pulsing animation)
   */
  static highlightTarget(target: GameTarget, highlight: boolean): void {
    const material = target.mesh.material as THREE.LineBasicMaterial

    if (highlight) {
      // Increase opacity and start pulsing
      material.opacity = 1.0
      material.transparent = true
      target.pulsePhase = 0
    } else {
      // Reset to normal
      material.opacity = 0.8
      material.transparent = true
      target.pulsePhase = undefined
    }
  }

  /**
   * Update pulsing animation for highlighted targets
   */
  static updatePulse(target: GameTarget, deltaTime: number): void {
    if (target.pulsePhase !== undefined) {
      target.pulsePhase += deltaTime * CONFIG.game.targets.pulseSpeed

      // Calculate pulse scale
      const pulseScale = 1.0 + Math.sin(target.pulsePhase) * 0.05
      target.mesh.scale.setScalar(pulseScale)

      // Update opacity
      const material = target.mesh.material as THREE.LineBasicMaterial
      material.opacity = 0.7 + Math.sin(target.pulsePhase) * 0.3
    } else {
      // Reset scale when not pulsing
      target.mesh.scale.setScalar(1.0)
    }
  }
}
