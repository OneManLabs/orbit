/**
 * GrabLock - Reference frame freezing mechanism
 * Prevents object jumping by storing initial hand and object state
 */

import * as THREE from 'three'
import type { HandPose, Transform, TransformDelta } from '../types'

export class GrabLock {
  private locked: boolean = false
  private referenceHandPose: HandPose | null = null
  private referenceObjectTransform: Transform | null = null

  /**
   * Lock the current hand pose and object transform
   */
  lock(handPose: HandPose, objectTransform: Transform): void {
    this.referenceHandPose = {
      position: handPose.position.clone(),
      rotation: handPose.rotation.clone(),
      scale: handPose.scale,
      landmarks: handPose.landmarks.map(l => l.clone())
    }

    this.referenceObjectTransform = {
      position: objectTransform.position.clone(),
      rotation: objectTransform.rotation.clone(),
      scale: objectTransform.scale.clone()
    }

    this.locked = true
  }

  /**
   * Calculate delta from reference to current hand pose
   */
  update(currentHandPose: HandPose): TransformDelta {
    if (!this.locked || !this.referenceHandPose) {
      return {
        position: new THREE.Vector3(),
        rotation: new THREE.Quaternion(),
        scale: 1.0
      }
    }

    // Calculate position delta
    const positionDelta = new THREE.Vector3()
      .subVectors(currentHandPose.position, this.referenceHandPose.position)

    // Calculate rotation delta
    const rotationDelta = new THREE.Quaternion()
      .copy(currentHandPose.rotation)
      .multiply(this.referenceHandPose.rotation.clone().invert())

    // Calculate scale delta
    const scaleDelta = currentHandPose.scale / this.referenceHandPose.scale

    return {
      position: positionDelta,
      rotation: rotationDelta,
      scale: scaleDelta
    }
  }

  /**
   * Release the lock
   */
  release(): void {
    this.locked = false
    this.referenceHandPose = null
    this.referenceObjectTransform = null
  }

  /**
   * Check if locked
   */
  isLocked(): boolean {
    return this.locked
  }

  /**
   * Get reference object transform
   */
  getReferenceTransform(): Transform | null {
    return this.referenceObjectTransform
  }
}
