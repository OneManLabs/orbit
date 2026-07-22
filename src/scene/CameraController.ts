/**
 * CameraController - Camera positioning and reset functionality
 */

import * as THREE from 'three'
import { CONFIG } from '../config'

export class CameraController {
  private camera: THREE.PerspectiveCamera
  private initialPosition: THREE.Vector3
  private initialLookAt: THREE.Vector3

  constructor(camera: THREE.PerspectiveCamera) {
    this.camera = camera

    // Store initial camera state
    this.initialPosition = new THREE.Vector3(
      CONFIG.camera.position.x,
      CONFIG.camera.position.y,
      CONFIG.camera.position.z
    )

    this.initialLookAt = new THREE.Vector3(
      CONFIG.camera.lookAt.x,
      CONFIG.camera.lookAt.y,
      CONFIG.camera.lookAt.z
    )
  }

  /**
   * Reset camera to initial position and orientation
   */
  public reset(): void {
    this.camera.position.copy(this.initialPosition)
    this.camera.lookAt(this.initialLookAt)
    this.camera.updateProjectionMatrix()

    console.log('Camera reset to initial position')
  }

  /**
   * Set camera position
   */
  public setPosition(x: number, y: number, z: number): void {
    this.camera.position.set(x, y, z)
    this.camera.updateProjectionMatrix()
  }

  /**
   * Set camera look-at target
   */
  public lookAt(x: number, y: number, z: number): void {
    this.camera.lookAt(x, y, z)
  }

  /**
   * Get current camera position
   */
  public getPosition(): THREE.Vector3 {
    return this.camera.position.clone()
  }
}
