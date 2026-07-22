/**
 * HandTrackingVisualizer - Display camera feed with hand landmarks overlay
 */

import type { HandFrameData } from '../types'

export class HandTrackingVisualizer {
  private videoElement: HTMLVideoElement
  private canvasElement: HTMLCanvasElement
  private ctx: CanvasRenderingContext2D

  // Hand landmark connections (MediaPipe hand model)
  private readonly HAND_CONNECTIONS = [
    [0, 1], [1, 2], [2, 3], [3, 4],           // Thumb
    [0, 5], [5, 6], [6, 7], [7, 8],           // Index finger
    [0, 9], [9, 10], [10, 11], [11, 12],      // Middle finger
    [0, 13], [13, 14], [14, 15], [15, 16],    // Ring finger
    [0, 17], [17, 18], [18, 19], [19, 20],    // Pinky
    [5, 9], [9, 13], [13, 17]                 // Palm
  ]

  constructor(videoElement: HTMLVideoElement) {
    this.videoElement = videoElement

    // Create canvas overlay
    this.canvasElement = document.getElementById('hand-tracking-canvas') as HTMLCanvasElement
    if (!this.canvasElement) {
      this.canvasElement = document.createElement('canvas')
      this.canvasElement.id = 'hand-tracking-canvas'
      document.getElementById('camera-feed-container')?.appendChild(this.canvasElement)
    }

    const ctx = this.canvasElement.getContext('2d')
    if (!ctx) {
      throw new Error('Could not get 2D context for hand tracking canvas')
    }
    this.ctx = ctx

    // Match canvas size to video
    this.setupCanvas()
  }

  private setupCanvas(): void {
    // Set canvas size to match video
    this.canvasElement.width = this.videoElement.videoWidth || 640
    this.canvasElement.height = this.videoElement.videoHeight || 480

    // Wait for video metadata to load
    this.videoElement.addEventListener('loadedmetadata', () => {
      this.canvasElement.width = this.videoElement.videoWidth
      this.canvasElement.height = this.videoElement.videoHeight
    })
  }

  /**
   * Update visualization with new hand frame data
   */
  update(frameData: HandFrameData): void {
    // Clear canvas
    this.ctx.clearRect(0, 0, this.canvasElement.width, this.canvasElement.height)

    // Draw each detected hand
    frameData.hands.forEach((hand, index) => {
      // Choose color based on handedness
      const color = hand.handedness === 'Left' ? '#00d9ff' : '#00ff88'  // Cyan for left, green for right

      // Draw connections first (so they appear behind landmarks)
      this.drawConnections(hand.landmarks, color)

      // Draw landmarks
      this.drawLandmarks(hand.landmarks, color)

      // Draw hand label
      this.drawHandLabel(hand, index)
    })

    // Draw info overlay
    this.drawInfoOverlay(frameData)
  }

  /**
   * Draw hand landmark connections
   */
  private drawConnections(landmarks: any[], color: string): void {
    this.ctx.strokeStyle = color
    this.ctx.lineWidth = 2

    this.HAND_CONNECTIONS.forEach(([start, end]) => {
      const startPoint = landmarks[start]
      const endPoint = landmarks[end]

      if (startPoint && endPoint) {
        this.ctx.beginPath()
        this.ctx.moveTo(
          startPoint.x * this.canvasElement.width,
          startPoint.y * this.canvasElement.height
        )
        this.ctx.lineTo(
          endPoint.x * this.canvasElement.width,
          endPoint.y * this.canvasElement.height
        )
        this.ctx.stroke()
      }
    })
  }

  /**
   * Draw hand landmarks as circles
   */
  private drawLandmarks(landmarks: any[], color: string): void {
    landmarks.forEach((landmark, index) => {
      const x = landmark.x * this.canvasElement.width
      const y = landmark.y * this.canvasElement.height

      // Draw outer circle
      this.ctx.beginPath()
      this.ctx.arc(x, y, 5, 0, 2 * Math.PI)
      this.ctx.fillStyle = color
      this.ctx.fill()

      // Draw inner circle (highlight)
      this.ctx.beginPath()
      this.ctx.arc(x, y, 2, 0, 2 * Math.PI)
      this.ctx.fillStyle = '#ffffff'
      this.ctx.fill()

      // Draw landmark number for key points (unmirrored so it reads correctly)
      if (index === 0 || index === 4 || index === 8 || index === 12 || index === 16 || index === 20) {
        this.drawUnmirroredText(index.toString(), x - 8, y + 4, '#ffffff', '10px monospace', 'left')
      }
    })
  }

  /**
   * Draw hand label (Left/Right)
   */
  private drawHandLabel(hand: any, index: number): void {
    if (hand.landmarks.length === 0) return

    // Draw label near wrist (landmark 0)
    const wrist = hand.landmarks[0]
    const x = wrist.x * this.canvasElement.width
    const y = wrist.y * this.canvasElement.height

    const color = hand.handedness === 'Left' ? '#00d9ff' : '#00ff88'

    // Draw background
    this.ctx.fillStyle = 'rgba(0, 0, 0, 0.7)'
    this.ctx.fillRect(x - 25, y - 30, 50, 20)

    // Draw text (unmirrored so it reads correctly on the flipped canvas)
    this.drawUnmirroredText(hand.handedness, x, y - 15, color, 'bold 12px Inter, sans-serif', 'center')
  }

  /**
   * Draw text that reads correctly even though the canvas is CSS-mirrored
   * (scaleX(-1)). Flips the context horizontally around the given x position.
   */
  private drawUnmirroredText(
    text: string,
    x: number,
    y: number,
    color: string,
    font: string,
    align: CanvasTextAlign
  ): void {
    this.ctx.save()
    this.ctx.translate(this.canvasElement.width, 0)
    this.ctx.scale(-1, 1)
    this.ctx.fillStyle = color
    this.ctx.font = font
    this.ctx.textAlign = align
    this.ctx.fillText(text, this.canvasElement.width - x, y)
    this.ctx.restore()
  }

  /**
   * Draw info overlay (hand count, confidence)
   */
  private drawInfoOverlay(frameData: HandFrameData): void {
    const padding = 10
    const lineHeight = 18

    // Draw background anchored to the visual top-left (canvas is mirrored)
    const w = this.canvasElement.width
    this.ctx.fillStyle = 'rgba(0, 0, 0, 0.7)'
    this.ctx.fillRect(w - padding - 180, padding, 180, lineHeight * 2 + 10)

    this.drawUnmirroredText(
      `Hands: ${frameData.hands.length}`,
      w - padding - 5,
      padding + lineHeight,
      '#00d9ff', '12px monospace', 'left'
    )

    const confidence = Math.round(frameData.confidence * 100)
    this.drawUnmirroredText(
      `Confidence: ${confidence}%`,
      w - padding - 5,
      padding + lineHeight * 2,
      '#00d9ff', '12px monospace', 'left'
    )
  }

  /**
   * Show the visualizer
   */
  show(): void {
    const container = document.getElementById('camera-feed-container')
    if (container) {
      container.style.display = 'block'
    }
  }

  /**
   * Hide the visualizer
   */
  hide(): void {
    const container = document.getElementById('camera-feed-container')
    if (container) {
      container.style.display = 'none'
    }
  }
}
