/**
 * GestureRecognizer - Detect specific hand gestures from landmarks
 */

import * as THREE from 'three'
import { CONFIG } from '../config'
import type { Hand, GestureResult, GestureType, HandFrameData } from '../types'

export class GestureRecognizer {
  /**
   * Recognize gestures from hand frame data
   */
  recognize(frameData: HandFrameData): GestureResult {
    if (frameData.hands.length === 0) {
      return { type: 'NONE' as GestureType, confidence: 0 }
    }

    // Priority order: Two-hand gestures > One-hand gestures

    // Check for two-hand manipulation (left pinch + right movement)
    if (frameData.hands.length === 2) {
      const twoHandManipulate = this.recognizeTwoHandManipulate(frameData.hands)
      if (twoHandManipulate.confidence > 0.5) {
        return twoHandManipulate
      }

      const twoHandScale = this.recognizeTwoHandScale(frameData.hands)
      if (twoHandScale.confidence > 0.5) {
        return twoHandScale
      }

      const twoHandTranslate = this.recognizeTwoHandTranslate(frameData.hands)
      if (twoHandTranslate.confidence > 0.5) {
        return twoHandTranslate
      }
    }

    // Check for one-hand gestures
    const hand = frameData.hands[0]

    const pinch = this.recognizePinch(hand)
    if (pinch.confidence > 0.5) {
      return pinch
    }

    const hover = this.recognizeHover(hand)
    if (hover.confidence > 0.5) {
      return hover
    }

    return { type: 'NONE' as GestureType, confidence: 0 }
  }

  /**
   * Recognize hover gesture (index finger extended, others curled)
   */
  recognizeHover(hand: Hand): GestureResult {
    const indexExtended = this.isFingerExtended(hand, 1)  // Index finger
    const middleCurled = !this.isFingerExtended(hand, 2)
    const ringCurled = !this.isFingerExtended(hand, 3)
    const pinkyCurled = !this.isFingerExtended(hand, 4)

    const isHovering = indexExtended && middleCurled && ringCurled && pinkyCurled

    let confidence = 0
    if (isHovering) {
      confidence = 0.5 +
        (middleCurled ? 0.2 : 0) +
        (ringCurled ? 0.15 : 0) +
        (pinkyCurled ? 0.15 : 0)
    }

    return {
      type: 'HOVER' as GestureType,
      confidence,
      metadata: {
        pointerPosition: hand.landmarks[8]  // Index finger tip
      }
    }
  }

  /**
   * Recognize pinch gesture (thumb + index finger tips close together)
   */
  recognizePinch(hand: Hand): GestureResult {
    const thumbTip = hand.landmarks[4]
    const indexTip = hand.landmarks[8]

    const distance = thumbTip.distanceTo(indexTip)
    const threshold = CONFIG.gestures.pinchDistanceThreshold

    if (distance < threshold) {
      // Closer = higher confidence
      const confidence = 1.0 - (distance / threshold)

      return {
        type: 'PINCH' as GestureType,
        confidence,
        metadata: {
          distance,
          pinchPosition: new THREE.Vector3().addVectors(thumbTip, indexTip).multiplyScalar(0.5)
        }
      }
    }

    return { type: 'NONE' as GestureType, confidence: 0 }
  }

  /**
   * Recognize two-hand manipulation (left hand pinch + right hand gesture)
   */
  recognizeTwoHandManipulate(hands: Hand[]): GestureResult {
    if (hands.length < 2) {
      return { type: 'NONE' as GestureType, confidence: 0 }
    }

    // Find left and right hands
    const leftHand = hands.find(h => h.handedness === 'Left')
    const rightHand = hands.find(h => h.handedness === 'Right')

    if (!leftHand || !rightHand) {
      return { type: 'NONE' as GestureType, confidence: 0 }
    }

    // Check if left hand is pinching (this is the "activation" hand)
    const leftPinch = this.recognizePinch(leftHand)

    if (leftPinch.confidence > 0.5) {
      // Left hand is pinching - now check right hand gesture
      const rightHandGesture = this.recognizeRightHandGesture(rightHand)
      const rightHandCenter = rightHand.landmarks[9]  // Middle MCP as center point

      return {
        type: 'PINCH' as GestureType,  // Keep as PINCH for state machine compatibility
        confidence: leftPinch.confidence,
        metadata: {
          mode: 'TWO_HAND',
          manipulationMode: rightHandGesture,  // ROTATE, TRANSLATE, or SCALE
          leftHand: leftHand,
          rightHand: rightHand,
          controlPosition: rightHandCenter,
          leftPinchPosition: leftPinch.metadata?.pinchPosition
        }
      }
    }

    return { type: 'NONE' as GestureType, confidence: 0 }
  }

  /**
   * Recognize right hand gesture for manipulation mode
   */
  private recognizeRightHandGesture(hand: Hand): string {
    // Check for pinch
    const pinch = this.recognizePinch(hand)
    if (pinch.confidence > 0.5) {
      return 'ROTATE'
    }

    // Check for open hand (all fingers extended)
    const indexExtended = this.isFingerExtended(hand, 1)
    const middleExtended = this.isFingerExtended(hand, 2)
    const ringExtended = this.isFingerExtended(hand, 3)
    const pinkyExtended = this.isFingerExtended(hand, 4)

    const allExtended = indexExtended && middleExtended && ringExtended && pinkyExtended
    if (allExtended) {
      return 'TRANSLATE'
    }

    // Check for fist (all fingers curled)
    const allCurled = !indexExtended && !middleExtended && !ringExtended && !pinkyExtended
    if (allCurled) {
      return 'SCALE'
    }

    // Default to translate if unclear
    return 'TRANSLATE'
  }

  /**
   * Recognize two-hand scale gesture (both hands pinching, distance changing)
   */
  recognizeTwoHandScale(hands: Hand[]): GestureResult {
    if (hands.length < 2) {
      return { type: 'NONE' as GestureType, confidence: 0 }
    }

    const hand1 = hands[0]
    const hand2 = hands[1]

    // Check if both hands are pinching
    const pinch1 = this.recognizePinch(hand1)
    const pinch2 = this.recognizePinch(hand2)

    if (pinch1.confidence > 0.5 && pinch2.confidence > 0.5) {
      const hand1Center = hand1.landmarks[9]  // Middle MCP
      const hand2Center = hand2.landmarks[9]

      const distance = hand1Center.distanceTo(hand2Center)

      return {
        type: 'TWO_HAND_SCALE' as GestureType,
        confidence: Math.min(pinch1.confidence, pinch2.confidence),
        metadata: {
          distance,
          hand1Position: hand1Center,
          hand2Position: hand2Center
        }
      }
    }

    return { type: 'NONE' as GestureType, confidence: 0 }
  }

  /**
   * Recognize two-hand translate gesture (both hands pinching, moving together)
   */
  recognizeTwoHandTranslate(hands: Hand[]): GestureResult {
    if (hands.length < 2) {
      return { type: 'NONE' as GestureType, confidence: 0 }
    }

    const hand1 = hands[0]
    const hand2 = hands[1]

    // Check if both hands are pinching
    const pinch1 = this.recognizePinch(hand1)
    const pinch2 = this.recognizePinch(hand2)

    if (pinch1.confidence > 0.5 && pinch2.confidence > 0.5) {
      const hand1Center = hand1.landmarks[9]  // Middle MCP
      const hand2Center = hand2.landmarks[9]

      // Calculate midpoint
      const midpoint = new THREE.Vector3()
        .addVectors(hand1Center, hand2Center)
        .multiplyScalar(0.5)

      return {
        type: 'TWO_HAND_TRANSLATE' as GestureType,
        confidence: Math.min(pinch1.confidence, pinch2.confidence),
        metadata: {
          midpoint,
          hand1Position: hand1Center,
          hand2Position: hand2Center
        }
      }
    }

    return { type: 'NONE' as GestureType, confidence: 0 }
  }

  /**
   * Check if a finger is extended
   */
  private isFingerExtended(hand: Hand, fingerIndex: number): boolean {
    // Finger landmark indices:
    // 0 = thumb, 1 = index, 2 = middle, 3 = ring, 4 = pinky
    // Each finger: tip, dip, pip, mcp (4 landmarks)

    const fingerTipIndex = 4 + fingerIndex * 4
    const fingerMcpIndex = fingerTipIndex - 3

    const tip = hand.landmarks[fingerTipIndex]
    const mcp = hand.landmarks[fingerMcpIndex]
    const wrist = hand.landmarks[0]

    // Finger is extended if tip is farther from wrist than MCP
    const tipDistance = tip.distanceTo(wrist)
    const mcpDistance = mcp.distanceTo(wrist)

    return tipDistance > mcpDistance * 1.2  // 20% threshold
  }
}
