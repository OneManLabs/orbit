/**
 * ShapeGenerator - Create game shapes for training game
 */

import * as THREE from 'three'
import { CONFIG } from '../config'
import type { Model, ModelPart } from '../types'
import { ShapeType, GameShape, LevelConfig } from './GameState'

export class ShapeGenerator {
  /**
   * Create a cube mesh
   */
  static createCube(color: number, position: THREE.Vector3): THREE.Mesh {
    const geometry = new THREE.BoxGeometry(
      CONFIG.game.shapes.size,
      CONFIG.game.shapes.size,
      CONFIG.game.shapes.size
    )

    const material = new THREE.MeshStandardMaterial({
      color: color,
      emissive: color,
      emissiveIntensity: 0.3,
      metalness: 0.5,
      roughness: 0.5
    })

    const mesh = new THREE.Mesh(geometry, material)
    mesh.position.copy(position)
    mesh.castShadow = true
    mesh.receiveShadow = true

    return mesh
  }

  /**
   * Create a sphere mesh
   */
  static createSphere(color: number, position: THREE.Vector3): THREE.Mesh {
    const geometry = new THREE.SphereGeometry(
      CONFIG.game.shapes.size / 2,
      32,
      32
    )

    const material = new THREE.MeshStandardMaterial({
      color: color,
      emissive: color,
      emissiveIntensity: 0.3,
      metalness: 0.5,
      roughness: 0.5
    })

    const mesh = new THREE.Mesh(geometry, material)
    mesh.position.copy(position)
    mesh.castShadow = true
    mesh.receiveShadow = true

    return mesh
  }

  /**
   * Create a cylinder mesh
   */
  static createCylinder(color: number, position: THREE.Vector3): THREE.Mesh {
    const geometry = new THREE.CylinderGeometry(
      CONFIG.game.shapes.size / 2.5,
      CONFIG.game.shapes.size / 2.5,
      CONFIG.game.shapes.size,
      32
    )

    const material = new THREE.MeshStandardMaterial({
      color: color,
      emissive: color,
      emissiveIntensity: 0.3,
      metalness: 0.5,
      roughness: 0.5
    })

    const mesh = new THREE.Mesh(geometry, material)
    mesh.position.copy(position)
    mesh.castShadow = true
    mesh.receiveShadow = true

    return mesh
  }

  /**
   * Create a game shape with Model wrapper for InteractionEngine
   */
  static createGameShape(
    type: ShapeType,
    color: number,
    position: THREE.Vector3,
    targetPosition: THREE.Vector3
  ): GameShape {
    // Create the mesh based on type
    let mesh: THREE.Mesh
    switch (type) {
      case ShapeType.CUBE:
        mesh = this.createCube(color, position)
        break
      case ShapeType.SPHERE:
        mesh = this.createSphere(color, position)
        break
      case ShapeType.CYLINDER:
        mesh = this.createCylinder(color, position)
        break
    }

    // Create a temporary Model wrapper for InteractionEngine
    const modelPart: ModelPart = {
      mesh: mesh,
      name: `${type}_${Date.now()}`,
      originalPosition: position.clone(),
      originalRotation: mesh.rotation.clone(),
      originalScale: mesh.scale.clone()
    }

    const group = new THREE.Group()
    group.add(mesh)

    const model: Model = {
      object: group,
      parts: [modelPart],
      boundingBox: new THREE.Box3().setFromObject(mesh)
    }

    return {
      mesh,
      type,
      color,
      targetPosition: targetPosition.clone(),
      isPlaced: false,
      model
    }
  }

  /**
   * Get available colors for shapes
   */
  private static getShapeColors(): number[] {
    return [
      CONFIG.game.shapes.colors.cube,
      CONFIG.game.shapes.colors.sphere,
      CONFIG.game.shapes.colors.cylinder,
      CONFIG.game.shapes.colors.yellow,
      CONFIG.game.shapes.colors.purple
    ]
  }

  /**
   * Create all shapes for a level
   */
  static createLevelShapes(levelConfig: LevelConfig): GameShape[] {
    const shapes: GameShape[] = []
    const colors = this.getShapeColors()
    const spawnPos = CONFIG.game.shapes.spawnPosition
    const spacing = CONFIG.game.shapes.spawnSpacing

    // Calculate starting X position to center shapes
    const totalWidth = (levelConfig.shapeCount - 1) * spacing
    const startX = -totalWidth / 2

    // Create each shape
    for (let i = 0; i < levelConfig.shapeCount; i++) {
      // Determine shape type
      const typeIndex = i % levelConfig.shapeTypes.length
      const shapeType = levelConfig.shapeTypes[typeIndex]

      // Assign color
      const color = colors[i % colors.length]

      // Calculate spawn position with small random offset
      const position = new THREE.Vector3(
        spawnPos.x + startX + (i * spacing) + (Math.random() - 0.5) * 0.1,
        spawnPos.y + (Math.random() - 0.5) * 0.05,
        spawnPos.z
      )

      // Calculate target position (will be set by level layout)
      // For now, use placeholder - GameMode will set actual positions
      const targetPosition = new THREE.Vector3(0, 0, 0)

      const shape = this.createGameShape(shapeType, color, position, targetPosition)
      shapes.push(shape)
    }

    return shapes
  }
}
