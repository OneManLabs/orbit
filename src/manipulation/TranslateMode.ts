/**
 * TranslateMode - Move object in 3D space
 */

import * as THREE from 'three'
import { CONFIG } from '../config'
import type { ModelPart, HandPose } from '../types'
import { GrabLock } from '../gestures/GrabLock'
import { TransformController } from '../scene/TransformController'

export class TranslateMode {
  private grabLock: GrabLock
  private transformController: TransformController
  private isActive: boolean = false

  constructor(grabLock: GrabLock, transformController: TransformController) {
    this.grabLock = grabLock
    this.transformController = transformController
  }

  /**
   * Activate translation mode
   */
  activate(part: ModelPart, handPose: HandPose): void {
    if (!this.grabLock.isLocked()) {
      const objectTransform = this.transformController.getCurrentTransform(part)
      this.grabLock.lock(handPose, objectTransform)
      this.isActive = true
      console.log('[TranslateMode] Activated')
    }
  }

  /**
   * Update translation based on hand movement
   */
  update(part: ModelPart, currentHandPose: HandPose): void {
    if (!this.isActive || !this.grabLock.isLocked()) {
      return
    }

    // Get delta from grab lock
    const delta = this.grabLock.update(currentHandPose)

    // Apply translation with sensitivity and speed multiplier
    // Negate to make object follow hand directly (right → right, up → up)
    const translation = new THREE.Vector3(
      -delta.position.x * CONFIG.manipulation.translateSensitivity * CONFIG.manipulation.speedMultiplier,
      -delta.position.y * CONFIG.manipulation.translateSensitivity * CONFIG.manipulation.speedMultiplier,
      0  // No Z translation for now
    )

    // Apply translation
    this.transformController.applyPositionDelta(part, translation)
  }

  /**
   * Deactivate translation mode
   */
  deactivate(): void {
    this.grabLock.release()
    this.isActive = false
    console.log('[TranslateMode] Deactivated')
  }

  /**
   * Check if active
   */
  getIsActive(): boolean {
    return this.isActive
  }
}
