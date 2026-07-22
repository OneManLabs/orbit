/**
 * InteractionEngine - Main orchestrator for 3D interaction
 * Connects hand tracking, gestures, state machine, and scene manipulation
 */

import * as THREE from 'three'
import type {
  HandFrameData,
  GestureResult,
  StateTransition,
  ModelPart,
  HandPose
} from '../types'
import { SceneManager } from '../scene/SceneManager'
import { RaycastManager } from '../scene/RaycastManager'
import { HighlightManager, HighlightType } from '../scene/HighlightManager'
import { TransformController } from '../scene/TransformController'
import { GrabLock } from '../gestures/GrabLock'
import { RotateMode } from '../manipulation/RotateMode'
import { TranslateMode } from '../manipulation/TranslateMode'
import { ScaleMode } from '../manipulation/ScaleMode'

export class InteractionEngine {
  private sceneManager: SceneManager
  private raycastManager: RaycastManager
  private highlightManager: HighlightManager
  private transformController: TransformController
  private grabLock: GrabLock
  private rotateMode: RotateMode
  private translateMode: TranslateMode
  private scaleMode: ScaleMode

  private hoveredPart: ModelPart | null = null
  private selectedPart: ModelPart | null = null
  private isManipulating: boolean = false
  private currentManipulationMode: string = 'ROTATE'  // Track active mode

  constructor(sceneManager: SceneManager) {
    this.sceneManager = sceneManager

    // Initialize managers
    this.raycastManager = new RaycastManager(sceneManager.getCamera())
    this.highlightManager = new HighlightManager()
    this.transformController = new TransformController()
    this.grabLock = new GrabLock()

    // Initialize manipulation modes
    this.rotateMode = new RotateMode(this.grabLock, this.transformController)
    this.translateMode = new TranslateMode(this.grabLock, this.transformController)
    this.scaleMode = new ScaleMode(this.grabLock, this.transformController)
  }

  /**
   * Update interaction based on gesture and state
   */
  update(
    frameData: HandFrameData,
    gesture: GestureResult,
    transition: StateTransition
  ): void {
    const currentState = transition.currentState

    // Handle state transitions
    if (transition.transitioned) {
      this.handleStateTransition(transition, frameData, gesture)
    }

    // Handle continuous updates based on current state
    switch (currentState) {
      case 'MANIPULATE':
        this.updateManipulation(frameData, gesture)
        break

      case 'IDLE':
      case 'HOVER':
        this.updateHover(frameData, gesture)
        break
    }
  }

  /**
   * Handle state transitions
   */
  private handleStateTransition(
    transition: StateTransition,
    frameData: HandFrameData,
    gesture: GestureResult
  ): void {
    const { previousState, currentState } = transition

    console.log(`State: ${previousState} → ${currentState}`)

    switch (currentState) {
      case 'IDLE':
        this.handleIdleEnter()
        break

      case 'HOVER':
        this.handleHoverEnter()
        break

      case 'GRAB':
        this.handleGrabEnter(frameData, gesture)
        break

      case 'MANIPULATE':
        this.handleManipulateEnter()
        break

      case 'RELEASE':
        this.handleReleaseEnter()
        break
    }
  }

  /**
   * IDLE state entered
   */
  private handleIdleEnter(): void {
    this.highlightManager.clearAllHighlights()
    this.hoveredPart = null
    this.selectedPart = null
    this.isManipulating = false
    console.log('[InteractionEngine] → IDLE')
  }

  /**
   * HOVER state entered
   */
  private handleHoverEnter(): void {
    console.log('[InteractionEngine] → HOVER (ready to grab)')
  }

  /**
   * GRAB state entered - Now grabs the entire model
   */
  private handleGrabEnter(frameData: HandFrameData, gesture: GestureResult): void {
    console.log('[InteractionEngine] → GRAB (grabbed entire model)')

    // Get the entire model
    const model = this.sceneManager.getModel()
    if (!model) {
      console.warn('[InteractionEngine] No model to grab')
      return
    }

    // For now, select the first part to represent the whole model
    // Later we'll refactor to manipulate the model's root group
    this.selectedPart = model.parts[0]

    // Check if this is two-hand mode
    const isTwoHandMode = gesture.metadata?.mode === 'TWO_HAND'

    if (isTwoHandMode) {
      const manipulationMode = gesture.metadata?.manipulationMode || 'ROTATE'
      this.currentManipulationMode = manipulationMode

      console.log(`[InteractionEngine] TWO-HAND mode: Left pinch + Right ${manipulationMode}`)
      this.updateSelectedPartUI(`Model (${manipulationMode})`)

      // Use right hand position for control
      const controlPosition = gesture.metadata?.controlPosition
      if (controlPosition) {
        const handPose: HandPose = {
          position: controlPosition,
          rotation: new THREE.Quaternion(),
          scale: 1.0,
          landmarks: gesture.metadata?.rightHand?.landmarks ?? []
        }

        // Activate the appropriate mode
        switch (manipulationMode) {
          case 'ROTATE':
            this.rotateMode.activate(this.selectedPart, handPose)
            console.log('[InteractionEngine] ✋ ROTATE mode activated')
            break
          case 'TRANSLATE':
            this.translateMode.activate(this.selectedPart, handPose)
            console.log('[InteractionEngine] 🖐️ TRANSLATE mode activated')
            break
          case 'SCALE':
            this.scaleMode.activate(this.selectedPart, handPose)
            console.log('[InteractionEngine] ✊ SCALE mode activated')
            break
        }
      }
    } else {
      // Single hand mode
      this.currentManipulationMode = 'ROTATE'
      console.log('[InteractionEngine] SINGLE-HAND mode')
      this.updateSelectedPartUI('Model (1-Hand ROTATE)')

      if (frameData.hands.length > 0 && gesture.metadata?.pinchPosition) {
        const hand = frameData.hands[0]
        const handPose: HandPose = {
          position: gesture.metadata.pinchPosition,
          rotation: new THREE.Quaternion(),
          scale: 1.0,
          landmarks: hand.landmarks
        }
        this.rotateMode.activate(this.selectedPart, handPose)
        console.log('[InteractionEngine] RotateMode activated (single hand)')
      }
    }
  }

  /**
   * MANIPULATE state entered
   */
  private handleManipulateEnter(): void {
    console.log('[InteractionEngine] → MANIPULATE (moving model)')
    if (this.selectedPart) {
      this.isManipulating = true
      this.highlightManager.highlightPart(this.selectedPart, HighlightType.MANIPULATING)
    }
  }

  /**
   * RELEASE state entered
   */
  private handleReleaseEnter(): void {
    console.log('[InteractionEngine] → RELEASE (released model)')
    this.isManipulating = false

    // Deactivate all manipulation modes
    this.rotateMode.deactivate()
    this.translateMode.deactivate()
    this.scaleMode.deactivate()

    if (this.selectedPart) {
      this.highlightManager.highlightPart(this.selectedPart, HighlightType.SELECTED)
    }
  }

  /**
   * Update hover detection
   */
  private updateHover(frameData: HandFrameData, gesture: GestureResult): void {
    if (frameData.hands.length === 0 || gesture.type !== 'HOVER') {
      // Clear hover if no hands or not hovering
      if (this.hoveredPart) {
        this.highlightManager.clearHighlight(this.hoveredPart)
        this.hoveredPart = null
      }
      return
    }

    // Get pointer position from gesture metadata
    const pointerPosition = gesture.metadata?.pointerPosition
    if (!pointerPosition) {
      return
    }

    // Raycast to find hovered object
    const model = this.sceneManager.getModel()
    if (!model) {
      return
    }

    const targets = model.parts.map(p => p.mesh)
    const hits = this.raycastManager.raycastFromHandLandmark(pointerPosition, targets)

    const closestHit = this.raycastManager.getClosestHit(hits)

    // Update hover
    if (closestHit) {
      // The hit may land on a child (e.g. propeller blades inside a group),
      // so walk up the ancestor chain to find the owning part
      const hitPart = model.parts.find(p => {
        let obj: THREE.Object3D | null = closestHit.object
        while (obj) {
          if (obj === p.mesh) return true
          obj = obj.parent
        }
        return false
      })

      if (hitPart && hitPart !== this.hoveredPart) {
        // Clear previous hover
        if (this.hoveredPart) {
          this.highlightManager.clearHighlight(this.hoveredPart)
        }

        // Set new hover
        this.hoveredPart = hitPart
        this.highlightManager.highlightPart(this.hoveredPart, HighlightType.HOVER)
      }
    } else {
      // No hit, clear hover
      if (this.hoveredPart) {
        this.highlightManager.clearHighlight(this.hoveredPart)
        this.hoveredPart = null
      }
    }
  }

  /**
   * Update manipulation
   */
  private updateManipulation(frameData: HandFrameData, gesture: GestureResult): void {
    if (!this.selectedPart || frameData.hands.length === 0) {
      return
    }

    // Check if this is two-hand mode
    const isTwoHandMode = gesture.metadata?.mode === 'TWO_HAND'

    if (isTwoHandMode) {
      // Check if manipulation mode changed
      const newManipulationMode = gesture.metadata?.manipulationMode || 'ROTATE'
      if (newManipulationMode !== this.currentManipulationMode) {
        console.log(`[InteractionEngine] Mode switch: ${this.currentManipulationMode} → ${newManipulationMode}`)

        // Deactivate old mode
        switch (this.currentManipulationMode) {
          case 'ROTATE': this.rotateMode.deactivate(); break
          case 'TRANSLATE': this.translateMode.deactivate(); break
          case 'SCALE': this.scaleMode.deactivate(); break
        }

        // Activate new mode
        const controlPosition = gesture.metadata?.controlPosition
        if (controlPosition) {
          const handPose: HandPose = {
            position: controlPosition,
            rotation: new THREE.Quaternion(),
            scale: 1.0,
            landmarks: gesture.metadata?.rightHand?.landmarks ?? []
          }

          switch (newManipulationMode) {
            case 'ROTATE': this.rotateMode.activate(this.selectedPart, handPose); break
            case 'TRANSLATE': this.translateMode.activate(this.selectedPart, handPose); break
            case 'SCALE': this.scaleMode.activate(this.selectedPart, handPose); break
          }
        }

        this.currentManipulationMode = newManipulationMode
        this.updateSelectedPartUI(`Model (${newManipulationMode})`)
      }

      // Update current mode
      const controlPosition = gesture.metadata?.controlPosition
      if (controlPosition) {
        const currentHandPose: HandPose = {
          position: controlPosition,
          rotation: new THREE.Quaternion(),
          scale: 1.0,
          landmarks: gesture.metadata?.rightHand?.landmarks ?? []
        }

        switch (this.currentManipulationMode) {
          case 'ROTATE':
            this.rotateMode.update(this.selectedPart, currentHandPose)
            break
          case 'TRANSLATE':
            this.translateMode.update(this.selectedPart, currentHandPose)
            break
          case 'SCALE':
            this.scaleMode.update(this.selectedPart, currentHandPose)
            break
        }
      }
    } else {
      // Single hand mode - always rotate
      const hand = frameData.hands[0]
      const pinchPosition = gesture.metadata?.pinchPosition || hand.landmarks[8]
      const currentHandPose: HandPose = {
        position: pinchPosition,
        rotation: new THREE.Quaternion(),
        scale: 1.0,
        landmarks: hand.landmarks
      }
      this.rotateMode.update(this.selectedPart, currentHandPose)
    }
  }

  /**
   * Reset selected part transform
   */
  resetSelectedPart(): void {
    if (this.selectedPart) {
      this.transformController.resetTransform(this.selectedPart)
    }
  }

  /**
   * Reset all parts
   */
  resetAllParts(): void {
    const model = this.sceneManager.getModel()
    if (model) {
      this.transformController.resetAllParts(model.parts)
    }
  }

  /**
   * Update UI with selected part name
   */
  private updateSelectedPartUI(partName: string): void {
    const selectedElement = document.getElementById('status-selected')
    if (selectedElement) {
      selectedElement.textContent = partName
    }

    const selectedPartElement = document.getElementById('selected-part')
    if (selectedPartElement) {
      selectedPartElement.textContent = partName
    }
  }

  /**
   * Get transform controller (for UI controls)
   */
  getTransformController(): TransformController {
    return this.transformController
  }

  /**
   * Get selected part
   */
  getSelectedPart(): ModelPart | null {
    return this.selectedPart
  }

  /**
   * Select a part explicitly (e.g. from the UI part list)
   */
  selectPart(part: ModelPart | null): void {
    if (this.selectedPart && this.selectedPart !== part) {
      this.highlightManager.clearHighlight(this.selectedPart)
    }

    this.selectedPart = part

    if (part) {
      this.highlightManager.highlightPart(part, HighlightType.SELECTED)
      this.updateSelectedPartUI(part.name)
    } else {
      this.updateSelectedPartUI('None')
    }
  }

  /**
   * Clear all highlights (used when swapping models)
   */
  clearHighlights(): void {
    this.highlightManager.clearAllHighlights()
    this.hoveredPart = null
    this.selectedPart = null
    this.updateSelectedPartUI('None')
  }
}
