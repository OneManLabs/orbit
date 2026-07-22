/**
 * IsolateMode - Show only selected part
 */

import type { Model, ModelPart } from '../types'

export class IsolateMode {
  private model: Model | null = null
  private isolatedPart: ModelPart | null = null
  private isActive: boolean = false

  /**
   * Set the model
   */
  setModel(model: Model): void {
    this.model = model
  }

  /**
   * Isolate a specific part
   */
  isolate(part: ModelPart): void {
    if (!this.model) return

    this.isolatedPart = part
    this.isActive = true

    // Hide all parts except the isolated one
    this.model.parts.forEach(p => {
      p.mesh.visible = (p === part)
    })
  }

  /**
   * Un-isolate (show all parts)
   */
  unIsolate(): void {
    if (!this.model) return

    this.isActive = false
    this.isolatedPart = null

    // Show all parts
    this.model.parts.forEach(p => {
      p.mesh.visible = true
    })
  }

  /**
   * Toggle isolation for a part
   */
  toggle(part: ModelPart): void {
    if (this.isActive && this.isolatedPart === part) {
      this.unIsolate()
    } else {
      this.isolate(part)
    }
  }

  /**
   * Check if mode is active
   */
  getIsActive(): boolean {
    return this.isActive
  }

  /**
   * Get isolated part
   */
  getIsolatedPart(): ModelPart | null {
    return this.isolatedPart
  }
}
