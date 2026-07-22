/**
 * ScaleMode - Scale object uniformly
 */

import * as THREE from 'three'
import { CONFIG } from '../config'
import type { ModelPart, HandPose } from '../types'
import { GrabLock } from '../gestures/GrabLock'
import { TransformController } from '../scene/TransformController'

export class ScaleMode {
  private grabLock: GrabLock
  private transformController: TransformController
  private isActive: boolean = false
  private initialDistance: number = 0

  constructor(grabLock: GrabLock, transformController: TransformController) {
    this.grabLock = grabLock
    this.transformController = transformController
  }

  /**
   * Activate scale mode
   */
  activate(part: ModelPart, handPose: HandPose): void {
    if (!this.grabLock.isLocked()) {
      const objectTransform = this.transformController.getCurrentTransform(part)
      this.grabLock.lock(handPose, objectTransform)

      // Store initial hand height (Y position) as reference
      this.initialDistance = handPose.position.y

      this.isActive = true
      console.log('[ScaleMode] Activated')
    }
  }

  /**
   * Update scale based on hand movement (vertical movement = scale)
   */
  update(part: ModelPart, currentHandPose: HandPose): void {
    if (!this.isActive || !this.grabLock.isLocked()) {
      return
    }

    // Get delta from grab lock
    const delta = this.grabLock.update(currentHandPose)

    // Use Y movement for scaling (up = bigger, down = smaller)
    // Scale factor: 1.0 + (delta.y * sensitivity * speedMultiplier)
    const scaleDelta = 1.0 + (delta.position.y * CONFIG.manipulation.scaleSensitivity * CONFIG.manipulation.speedMultiplier)

    // Clamp scale
    const clampedScale = Math.max(
      CONFIG.manipulation.scaleMin,
      Math.min(CONFIG.manipulation.scaleMax, scaleDelta)
    )

    // Apply scale (relative to original scale)
    this.transformController.applyScaleDelta(part, clampedScale)
  }

  /**
   * Deactivate scale mode
   */
  deactivate(): void {
    this.grabLock.release()
    this.isActive = false
    console.log('[ScaleMode] Deactivated')
  }

  /**
   * Check if active
   */
  getIsActive(): boolean {
    return this.isActive
  }
}
