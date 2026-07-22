/**
 * TransformController - Apply transforms to model parts with smoothing
 */

import * as THREE from 'three'
import { CONFIG } from '../config'
import type { ModelPart, Transform } from '../types'

export class TransformController {
  private smoothingAlpha: number = CONFIG.manipulation.transformSmoothingAlpha

  /**
   * Apply rotation to a part with optional smoothing
   */
  applyRotation(part: ModelPart, rotation: THREE.Quaternion, smooth: boolean = true): void {
    if (smooth) {
      // SLERP for smooth rotation
      part.mesh.quaternion.slerp(rotation, this.smoothingAlpha)
    } else {
      part.mesh.quaternion.copy(rotation)
    }
  }

  /**
   * Apply scale to a part with optional smoothing
   */
  applyScale(part: ModelPart, scale: number, smooth: boolean = true): void {
    // Clamp scale
    const clampedScale = THREE.MathUtils.clamp(
      scale,
      CONFIG.manipulation.scaleMin,
      CONFIG.manipulation.scaleMax
    )

    const targetScale = new THREE.Vector3(clampedScale, clampedScale, clampedScale)

    if (smooth) {
      // LERP for smooth scaling
      part.mesh.scale.lerp(targetScale, this.smoothingAlpha)
    } else {
      part.mesh.scale.copy(targetScale)
    }
  }

  /**
   * Apply translation to a part with optional smoothing
   */
  applyTranslation(part: ModelPart, translation: THREE.Vector3, smooth: boolean = true): void {
    if (smooth) {
      // LERP for smooth translation
      part.mesh.position.lerp(translation, this.smoothingAlpha)
    } else {
      part.mesh.position.copy(translation)
    }
  }

  /**
   * Apply incremental rotation delta
   */
  applyRotationDelta(part: ModelPart, deltaRotation: THREE.Quaternion): void {
    const newRotation = part.mesh.quaternion.clone().multiply(deltaRotation)
    this.applyRotation(part, newRotation, true)
  }

  /**
   * Apply incremental position delta
   */
  applyPositionDelta(part: ModelPart, deltaPosition: THREE.Vector3): void {
    const newPosition = part.mesh.position.clone().add(deltaPosition)
    this.applyTranslation(part, newPosition, true)
  }

  /**
   * Apply incremental scale delta (relative to current scale)
   */
  applyScaleDelta(part: ModelPart, scaleFactor: number): void {
    const currentScale = part.mesh.scale.x  // Assuming uniform scale
    const newScale = currentScale * scaleFactor
    this.applyScale(part, newScale, true)
  }

  /**
   * Reset transform to original state
   */
  resetTransform(part: ModelPart): void {
    part.mesh.position.copy(part.originalPosition)
    part.mesh.rotation.copy(part.originalRotation)
    part.mesh.scale.copy(part.originalScale)
  }

  /**
   * Reset all parts in a model
   */
  resetAllParts(parts: ModelPart[]): void {
    parts.forEach(part => this.resetTransform(part))
  }

  /**
   * Get current transform
   */
  getCurrentTransform(part: ModelPart): Transform {
    return {
      position: part.mesh.position.clone(),
      rotation: part.mesh.rotation.clone(),
      scale: part.mesh.scale.clone()
    }
  }
}
