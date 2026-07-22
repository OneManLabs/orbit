/**
 * ExplodeMode - Part separation for inspection
 */

import * as THREE from 'three'
import { CONFIG } from '../config'
import type { Model, ModelPart } from '../types'

export class ExplodeMode {
  private model: Model | null = null
  private explodeFactor: number = 0  // 0 = assembled, 1 = fully exploded

  /**
   * Set the model to explode
   */
  setModel(model: Model): void {
    this.model = model
  }

  /**
   * Set explode factor (0-1)
   */
  setExplodeFactor(factor: number): void {
    this.explodeFactor = THREE.MathUtils.clamp(factor, 0, 1)
    this.updateExplode()
  }

  /**
   * Update part positions based on explode factor
   */
  private updateExplode(): void {
    if (!this.model) return

    // Calculate model center
    const center = new THREE.Vector3()
    this.model.boundingBox.getCenter(center)

    // Update each part
    this.model.parts.forEach(part => {
      // Direction from model center to the part's ORIGINAL position so the
      // direction stays stable as parts move outward
      const direction = new THREE.Vector3()
        .subVectors(part.originalPosition, center)

      // Parts at the exact center explode upward
      if (direction.lengthSq() < 1e-8) {
        direction.set(0, 1, 0)
      }
      direction.normalize()

      // Calculate explode offset
      const offset = direction
        .multiplyScalar(this.explodeFactor * CONFIG.manipulation.explodeDistance)

      // Apply offset to original position
      part.mesh.position.copy(part.originalPosition).add(offset)
    })
  }

  /**
   * Reset to assembled state
   */
  reset(): void {
    this.explodeFactor = 0
    this.updateExplode()
  }

  /**
   * Get current explode factor
   */
  getExplodeFactor(): number {
    return this.explodeFactor
  }
}
