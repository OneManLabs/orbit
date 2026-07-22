/**
 * GestureStateMachine - Manage state transitions with hysteresis
 */

import { CONFIG } from '../config'
import type { State, StateTransition, GestureResult, HandFrameData } from '../types'

export class GestureStateMachine {
  private currentState: State = 'IDLE'
  private stateBuffer: State[] = []
  private bufferSize: number = CONFIG.stateMachine.stateHysteresisFrames

  /**
   * Update state based on gesture recognition
   */
  update(gesture: GestureResult, frameData: HandFrameData): StateTransition {
    const previousState = this.currentState

    // Determine target state based on gesture and current state
    const targetState = this.determineTargetState(gesture, frameData)

    // Add to buffer
    this.stateBuffer.push(targetState)
    if (this.stateBuffer.length > this.bufferSize) {
      this.stateBuffer.shift()
    }

    // Check if we should transition
    const consensusState = this.getConsensusState()
    let transitioned = false

    if (consensusState && consensusState !== this.currentState) {
      this.currentState = consensusState
      transitioned = true
    }

    return {
      previousState,
      currentState: this.currentState,
      transitioned,
      metadata: {
        gesture: gesture.type,
        confidence: gesture.confidence
      }
    }
  }

  /**
   * Determine target state based on gesture and current state
   */
  private determineTargetState(gesture: GestureResult, frameData: HandFrameData): State {
    const { type, confidence } = gesture

    // No hands detected -> Idle
    if (frameData.hands.length === 0) {
      return 'IDLE'
    }

    // State machine transitions
    switch (this.currentState) {
      case 'IDLE':
        // Any gesture (hover or pinch) brings us out of idle
        if (type === 'HOVER' && confidence > CONFIG.stateMachine.hoverConfidenceThreshold) {
          return 'HOVER'
        }
        if (type === 'PINCH' && confidence > CONFIG.stateMachine.grabConfidenceThreshold) {
          return 'GRAB'
        }
        return 'IDLE'

      case 'HOVER':
        // Pinch gesture transitions to grab
        if (type === 'PINCH' && confidence > CONFIG.stateMachine.grabConfidenceThreshold) {
          return 'GRAB'
        }
        if (type === 'HOVER' && confidence > CONFIG.stateMachine.hoverConfidenceThreshold) {
          return 'HOVER'
        }
        return 'IDLE'

      case 'GRAB':
        // Check if pinch is released
        if (type !== 'PINCH' || confidence < CONFIG.stateMachine.releaseConfidenceThreshold) {
          return 'RELEASE'
        }
        // Check if movement started (transition to manipulate)
        // For now, immediately go to manipulate if still pinching
        return 'MANIPULATE'

      case 'MANIPULATE':
        // Check if pinch is released
        if (type !== 'PINCH' || confidence < CONFIG.stateMachine.releaseConfidenceThreshold) {
          return 'RELEASE'
        }
        return 'MANIPULATE'

      case 'RELEASE':
        // Always return to idle after release
        return 'IDLE'

      default:
        return 'IDLE'
    }
  }

  /**
   * Get consensus state from buffer (all states must match)
   */
  private getConsensusState(): State | null {
    if (this.stateBuffer.length < this.bufferSize) {
      return null
    }

    const firstState = this.stateBuffer[0]
    const unanimous = this.stateBuffer.every(s => s === firstState)

    return unanimous ? firstState : null
  }

  /**
   * Get current state
   */
  getCurrentState(): State {
    return this.currentState
  }

  /**
   * Reset state machine
   */
  reset(): void {
    this.currentState = 'IDLE'
    this.stateBuffer = []
  }
}
