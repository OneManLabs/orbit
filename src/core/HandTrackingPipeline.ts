/**
 * HandTrackingPipeline - MediaPipe Hands integration for webcam-based hand tracking
 */

import { HandLandmarker, FilesetResolver } from '@mediapipe/tasks-vision'
import * as THREE from 'three'
import { CONFIG } from '../config'
import type { Hand, HandFrameData } from '../types'

export class HandTrackingPipeline {
  private handLandmarker: HandLandmarker | null = null
  private videoElement: HTMLVideoElement | null = null
  private stream: MediaStream | null = null
  private isRunning: boolean = false
  private lastVideoTime: number = -1

  private frameCallback: ((data: HandFrameData) => void) | null = null

  /**
   * Initialize MediaPipe Hand Landmarker
   */
  async initialize(): Promise<void> {
    try {
      console.log('Initializing MediaPipe Hand Landmarker...')

      // Load MediaPipe WASM files from local directory (fully offline)
      const vision = await FilesetResolver.forVisionTasks(
        '/mediapipe/wasm'
      )

      // Create hand landmarker from local model file
      this.handLandmarker = await HandLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: '/mediapipe/hands.task',
          delegate: 'GPU'
        },
        numHands: CONFIG.handTracking.numHands,
        minHandDetectionConfidence: CONFIG.handTracking.minDetectionConfidence,
        minHandPresenceConfidence: CONFIG.handTracking.minTrackingConfidence,
        minTrackingConfidence: CONFIG.handTracking.minTrackingConfidence,
        runningMode: 'VIDEO'
      })

      console.log('✓ MediaPipe Hand Landmarker initialized')
    } catch (error) {
      console.error('Failed to initialize MediaPipe:', error)
      throw new Error(`MediaPipe initialization failed: ${(error as Error).message}`)
    }
  }

  /**
   * Start webcam and hand tracking
   */
  async start(): Promise<void> {
    if (!this.handLandmarker) {
      throw new Error('HandLandmarker not initialized. Call initialize() first.')
    }

    try {
      console.log('Requesting camera access...')

      // Request webcam access
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: CONFIG.handTracking.camera.width,
          height: CONFIG.handTracking.camera.height,
          frameRate: CONFIG.handTracking.camera.fps
        }
      })

      // Use existing video element from HTML
      this.videoElement = document.getElementById('camera-video') as HTMLVideoElement
      if (!this.videoElement) {
        throw new Error('Camera video element not found')
      }

      this.videoElement.srcObject = this.stream
      this.videoElement.autoplay = true
      this.videoElement.playsInline = true
      this.videoElement.muted = true

      await this.videoElement.play()

      this.isRunning = true
      console.log('✓ Camera started')

      // Update status
      this.updateHandTrackingStatus(true)

      // Start processing frames
      this.processFrame()

    } catch (error) {
      console.error('Failed to start camera:', error)
      this.updateHandTrackingStatus(false)

      if ((error as Error).name === 'NotAllowedError') {
        throw new Error('Camera access denied. Please allow camera access and reload.')
      } else if ((error as Error).name === 'NotFoundError') {
        throw new Error('No camera found. Please connect a camera and reload.')
      } else {
        throw new Error(`Camera error: ${(error as Error).message}`)
      }
    }
  }

  /**
   * Get video element (for visualization)
   */
  getVideoElement(): HTMLVideoElement | null {
    return this.videoElement
  }

  /**
   * Stop hand tracking and release camera
   */
  stop(): void {
    this.isRunning = false

    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop())
      this.stream = null
    }

    if (this.videoElement) {
      this.videoElement.srcObject = null
      this.videoElement = null
    }

    this.updateHandTrackingStatus(false)
    console.log('Hand tracking stopped')
  }

  /**
   * Process video frames
   */
  private processFrame(): void {
    if (!this.isRunning || !this.videoElement || !this.handLandmarker) {
      return
    }

    const currentTime = this.videoElement.currentTime

    // Only process if video time has advanced
    if (currentTime !== this.lastVideoTime) {
      this.lastVideoTime = currentTime

      try {
        // Detect hands
        const results = this.handLandmarker.detectForVideo(
          this.videoElement,
          performance.now()
        )

        // Convert results to our format
        const frameData = this.convertResults(results)

        // Emit frame data
        if (this.frameCallback) {
          this.frameCallback(frameData)
        }

      } catch (error) {
        console.error('Frame processing error:', error)
      }
    }

    // Continue processing
    requestAnimationFrame(() => this.processFrame())
  }

  /**
   * Convert MediaPipe results to our HandFrameData format
   */
  private convertResults(results: any): HandFrameData {
    const hands: Hand[] = []
    let totalConfidence = 0

    if (results.landmarks && results.landmarks.length > 0) {
      for (let i = 0; i < results.landmarks.length; i++) {
        const landmarks: THREE.Vector3[] = []

        // Convert landmarks to THREE.Vector3
        for (const landmark of results.landmarks[i]) {
          landmarks.push(new THREE.Vector3(landmark.x, landmark.y, landmark.z))
        }

        // Get handedness
        const handedness = results.handednesses[i]?.[0]?.categoryName || 'Unknown'

        // Get world landmarks if available
        const worldLandmarks: THREE.Vector3[] = []
        if (results.worldLandmarks && results.worldLandmarks[i]) {
          for (const landmark of results.worldLandmarks[i]) {
            worldLandmarks.push(new THREE.Vector3(landmark.x, landmark.y, landmark.z))
          }
        }

        hands.push({
          landmarks,
          handedness: handedness as 'Left' | 'Right',
          worldLandmarks
        })

        // Accumulate confidence
        totalConfidence += results.handednesses[i]?.[0]?.score || 0
      }
    }

    // Calculate average confidence
    const confidence = hands.length > 0 ? totalConfidence / hands.length : 0

    return {
      timestamp: performance.now(),
      hands,
      confidence
    }
  }

  /**
   * Register callback for frame data
   */
  onFrame(callback: (data: HandFrameData) => void): void {
    this.frameCallback = callback
  }

  /**
   * Get current confidence score
   */
  getConfidence(): number {
    // This will be provided through the frame callback
    return 0
  }

  /**
   * Update UI status indicator
   */
  private updateHandTrackingStatus(active: boolean): void {
    const statusElement = document.getElementById('hand-tracking-status')
    const textElement = document.getElementById('hand-tracking-text')

    if (statusElement && textElement) {
      if (active) {
        statusElement.classList.add('status-indicator--active')
        statusElement.classList.remove('status-indicator--error')
        textElement.textContent = 'Active'
      } else {
        statusElement.classList.remove('status-indicator--active')
        statusElement.classList.add('status-indicator--error')
        textElement.textContent = 'Inactive'
      }
    }
  }

  /**
   * Check if tracking is running
   */
  isActive(): boolean {
    return this.isRunning
  }

  /**
   * Dispose resources
   */
  dispose(): void {
    this.stop()
    if (this.handLandmarker) {
      this.handLandmarker.close()
      this.handLandmarker = null
    }
  }
}
