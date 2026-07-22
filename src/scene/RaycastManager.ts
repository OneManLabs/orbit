/**
 * RaycastManager - Hand position → 3D raycasting for object picking
 */

import * as THREE from 'three'
import type { RaycastHit } from '../types'

export class RaycastManager {
  private raycaster: THREE.Raycaster
  private camera: THREE.Camera

  constructor(camera: THREE.Camera) {
    this.camera = camera
    this.raycaster = new THREE.Raycaster()
  }

  /**
   * Raycast from hand landmark (normalized 0-1 coords) into scene
   */
  raycastFromHandLandmark(
    landmark: THREE.Vector3,
    targets: THREE.Object3D[]
  ): RaycastHit[] {
    // Convert MediaPipe normalized coords to NDC
    // MediaPipe: (0,0) = top-left, (1,1) = bottom-right
    // NDC: (-1,-1) = bottom-left, (1,1) = top-right
    const ndcX = landmark.x * 2 - 1
    const ndcY = -(landmark.y * 2 - 1)  // Flip Y axis

    return this.raycastFromNDC(ndcX, ndcY, targets)
  }

  /**
   * Raycast from screen position (pixels) into scene
   */
  raycastFromScreenPosition(
    screenX: number,
    screenY: number,
    screenWidth: number,
    screenHeight: number,
    targets: THREE.Object3D[]
  ): RaycastHit[] {
    // Convert screen coords to NDC
    const ndcX = (screenX / screenWidth) * 2 - 1
    const ndcY = -(screenY / screenHeight) * 2 + 1

    return this.raycastFromNDC(ndcX, ndcY, targets)
  }

  /**
   * Raycast from NDC coordinates
   */
  private raycastFromNDC(
    ndcX: number,
    ndcY: number,
    targets: THREE.Object3D[]
  ): RaycastHit[] {
    // Set raycaster from camera through NDC point
    this.raycaster.setFromCamera(new THREE.Vector2(ndcX, ndcY), this.camera)

    // Perform raycast
    const intersects = this.raycaster.intersectObjects(targets, true)

    // Convert to our format
    const hits: RaycastHit[] = intersects.map(intersect => ({
      object: intersect.object,
      distance: intersect.distance,
      point: intersect.point,
      face: intersect.face || null
    }))

    return hits
  }

  /**
   * Get closest hit
   */
  getClosestHit(hits: RaycastHit[]): RaycastHit | null {
    if (hits.length === 0) return null
    return hits[0]  // Already sorted by distance
  }
}
