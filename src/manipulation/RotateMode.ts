/**
 * RotateMode - One-hand rotation manipulation
 */

import * as THREE from 'three'
import { CONFIG } from '../config'
import type { ModelPart, HandPose } from '../types'
import { GrabLock } from '../gestures/GrabLock'
import { TransformController } from '../scene/TransformController'

export class RotateMode {
  private grabLock: GrabLock
  private transformController: TransformController
  private isActive: boolean = false

  constructor(grabLock: GrabLock, transformController: TransformController) {
    this.grabLock = grabLock
    this.transformController = transformController
  }

  /**
   * Activate rotation mode
   */
  activate(part: ModelPart, handPose: HandPose): void {
    if (!this.grabLock.isLocked()) {
      // Get current object transform
      const objectTransform = this.transformController.getCurrentTransform(part)

      // Lock the reference frame
      this.grabLock.lock(handPose, objectTransform)
      this.isActive = true
      console.log('[RotateMode] Activated with hand position:', handPose.position)
    }
  }

  /**
   * Update rotation based on hand movement
   */
  update(part: ModelPart, currentHandPose: HandPose): void {
    if (!this.isActive || !this.grabLock.isLocked()) {
      return
    }

    // Get delta from grab lock
    const delta = this.grabLock.update(currentHandPose)

    // Convert position delta to rotation
    // X movement → Y-axis rotation
    // Y movement → X-axis rotation
    // Inverted for direct control (hand right → object rotates right)
    const rotationX = delta.position.y * CONFIG.manipulation.rotateSensitivityY * CONFIG.manipulation.speedMultiplier
    const rotationY = -delta.position.x * CONFIG.manipulation.rotateSensitivityX * CONFIG.manipulation.speedMultiplier

    // Create rotation quaternion
    const rotation = new THREE.Quaternion()
    const eulerRotation = new THREE.Euler(rotationX, rotationY, 0, 'XYZ')
    rotation.setFromEuler(eulerRotation)

    // Apply rotation delta
    this.transformController.applyRotationDelta(part, rotation)
  }

  /**
   * Deactivate rotation mode
   */
  deactivate(): void {
    this.grabLock.release()
    this.isActive = false
  }

  /**
   * Check if active
   */
  getIsActive(): boolean {
    return this.isActive
  }
}
