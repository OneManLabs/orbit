/**
 * HighlightManager - Visual feedback for hover and selection
 */

import * as THREE from 'three'
import type { ModelPart } from '../types'

export enum HighlightType {
  NONE = 'NONE',
  HOVER = 'HOVER',
  SELECTED = 'SELECTED',
  MANIPULATING = 'MANIPULATING'
}

interface MaterialState {
  emissive: THREE.Color
  emissiveIntensity: number
}

export class HighlightManager {
  private originalMaterials: Map<THREE.Mesh, MaterialState> = new Map()
  private currentHighlights: Map<THREE.Mesh, HighlightType> = new Map()

  /**
   * Highlight a part with specific type
   */
  highlightPart(part: ModelPart, type: HighlightType): void {
    const mesh = part.mesh

    // Store original material if not already stored
    if (!this.originalMaterials.has(mesh)) {
      const material = mesh.material as THREE.MeshStandardMaterial
      this.originalMaterials.set(mesh, {
        emissive: material.emissive.clone(),
        emissiveIntensity: material.emissiveIntensity
      })
    }

    // Apply highlight based on type
    const material = mesh.material as THREE.MeshStandardMaterial

    switch (type) {
      case HighlightType.HOVER:
        material.emissive.setHex(0x00d9ff)  // Cyan
        material.emissiveIntensity = 0.2
        break

      case HighlightType.SELECTED:
        material.emissive.setHex(0x00d9ff)  // Cyan
        material.emissiveIntensity = 0.4
        break

      case HighlightType.MANIPULATING:
        material.emissive.setHex(0xffb800)  // Warning amber
        material.emissiveIntensity = 0.5
        break

      case HighlightType.NONE:
        this.clearHighlight(part)
        return
    }

    this.currentHighlights.set(mesh, type)
  }

  /**
   * Clear highlight from a part
   */
  clearHighlight(part: ModelPart): void {
    const mesh = part.mesh
    const originalState = this.originalMaterials.get(mesh)

    if (originalState) {
      const material = mesh.material as THREE.MeshStandardMaterial
      material.emissive.copy(originalState.emissive)
      material.emissiveIntensity = originalState.emissiveIntensity
    }

    this.currentHighlights.delete(mesh)
  }

  /**
   * Clear all highlights
   */
  clearAllHighlights(): void {
    this.currentHighlights.forEach((type, mesh) => {
      const originalState = this.originalMaterials.get(mesh)
      if (originalState) {
        const material = mesh.material as THREE.MeshStandardMaterial
        material.emissive.copy(originalState.emissive)
        material.emissiveIntensity = originalState.emissiveIntensity
      }
    })

    this.currentHighlights.clear()
  }

  /**
   * Get current highlight type for a part
   */
  getHighlightType(part: ModelPart): HighlightType {
    return this.currentHighlights.get(part.mesh) || HighlightType.NONE
  }
}
