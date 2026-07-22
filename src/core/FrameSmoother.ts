/**
 * FrameSmoother - Landmark smoothing using One-Euro Filter
 * Reduces jitter while maintaining responsiveness
 */

import * as THREE from 'three'
import { CONFIG } from '../config'
import type { Hand, HandFrameData } from '../types'

/**
 * One-Euro Filter for single value smoothing
 * Combines low-pass filter with adaptive cutoff based on velocity
 */
class OneEuroFilter {
  private prevValue: number = 0
  private prevDValue: number = 0
  private prevTime: number = 0

  constructor(
    private minCutoff: number = 1.0,
    private beta: number = 0.7,
    private dCutoff: number = 1.0
  ) {}

  filter(value: number, timestamp: number): number {
    if (this.prevTime === 0) {
      this.prevTime = timestamp
      this.prevValue = value
      return value
    }

    // Timestamps arrive in milliseconds; the filter cutoffs are in Hz (seconds)
    const dt = (timestamp - this.prevTime) / 1000
    if (dt <= 0) return this.prevValue

    // Derivative
    const dValue = (value - this.prevValue) / dt
    const smoothedDValue = this.lowpass(dValue, this.prevDValue, this.alpha(dt, this.dCutoff))

    // Adaptive cutoff
    const cutoff = this.minCutoff + this.beta * Math.abs(smoothedDValue)

    // Filtered value
    const smoothedValue = this.lowpass(value, this.prevValue, this.alpha(dt, cutoff))

    this.prevValue = smoothedValue
    this.prevDValue = smoothedDValue
    this.prevTime = timestamp

    return smoothedValue
  }

  private lowpass(current: number, previous: number, alpha: number): number {
    return alpha * current + (1 - alpha) * previous
  }

  private alpha(dt: number, cutoff: number): number {
    const tau = 1.0 / (2 * Math.PI * cutoff)
    return 1.0 / (1.0 + tau / dt)
  }

  reset(): void {
    this.prevValue = 0
    this.prevDValue = 0
    this.prevTime = 0
  }
}

export class FrameSmoother {
  private filters: Map<string, OneEuroFilter[]> = new Map()
  private confidenceHistory: number[] = []

  constructor(
    private minCutoff: number = CONFIG.smoothing.minCutoff,
    private beta: number = CONFIG.smoothing.beta,
    private confidenceWindow: number = CONFIG.smoothing.confidenceWindow
  ) {}

  /**
   * Smooth hand frame data
   */
  smooth(frameData: HandFrameData): HandFrameData {
    const smoothedHands: Hand[] = []

    for (let i = 0; i < frameData.hands.length; i++) {
      const hand = frameData.hands[i]
      const handKey = `${hand.handedness}_${i}`

      // Get or create filters for this hand
      if (!this.filters.has(handKey)) {
        this.filters.set(handKey, this.createFiltersForHand())
      }

      const filters = this.filters.get(handKey)!
      const smoothedLandmarks: THREE.Vector3[] = []

      // Smooth each landmark (21 landmarks × 3 coordinates = 63 filters)
      for (let j = 0; j < hand.landmarks.length; j++) {
        const landmark = hand.landmarks[j]
        const filterIndex = j * 3

        const x = filters[filterIndex].filter(landmark.x, frameData.timestamp)
        const y = filters[filterIndex + 1].filter(landmark.y, frameData.timestamp)
        const z = filters[filterIndex + 2].filter(landmark.z, frameData.timestamp)

        smoothedLandmarks.push(new THREE.Vector3(x, y, z))
      }

      smoothedHands.push({
        ...hand,
        landmarks: smoothedLandmarks
      })
    }

    // Smooth confidence
    const smoothedConfidence = this.smoothConfidence(frameData.confidence)

    return {
      timestamp: frameData.timestamp,
      hands: smoothedHands,
      confidence: smoothedConfidence
    }
  }

  /**
   * Create filters for all landmarks of a hand (21 landmarks × 3 coords = 63 filters)
   */
  private createFiltersForHand(): OneEuroFilter[] {
    const filters: OneEuroFilter[] = []
    for (let i = 0; i < 21 * 3; i++) {
      filters.push(new OneEuroFilter(this.minCutoff, this.beta))
    }
    return filters
  }

  /**
   * Smooth confidence score using rolling average
   */
  private smoothConfidence(confidence: number): number {
    this.confidenceHistory.push(confidence)

    if (this.confidenceHistory.length > this.confidenceWindow) {
      this.confidenceHistory.shift()
    }

    const sum = this.confidenceHistory.reduce((a, b) => a + b, 0)
    return sum / this.confidenceHistory.length
  }

  /**
   * Reset all filters
   */
  reset(): void {
    this.filters.clear()
    this.confidenceHistory = []
  }
}
