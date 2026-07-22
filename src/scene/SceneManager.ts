/**
 * SceneManager - Three.js scene, camera, renderer, lights initialization and management
 */

import * as THREE from 'three'
import { CONFIG } from '../config'
import type { Model, ModelPart } from '../types'

export class SceneManager {
  private scene: THREE.Scene
  private camera: THREE.PerspectiveCamera
  private renderer: THREE.WebGLRenderer
  private canvas: HTMLCanvasElement

  private model: Model | null = null
  private selectedPart: ModelPart | null = null

  private gridHelper: THREE.GridHelper
  private axesHelper: THREE.AxesHelper

  private animationFrameId: number | null = null
  private lastFpsTime: number = 0
  private lastRenderTime: number = 0
  private frameCount: number = 0
  private fps: number = 0

  private updateCallback: ((deltaSeconds: number) => void) | null = null
  private boundHandleResize = this.handleResize.bind(this)

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas

    // Initialize scene
    this.scene = new THREE.Scene()
    this.scene.background = new THREE.Color(CONFIG.rendering.backgroundColor)

    // Initialize camera
    const aspect = window.innerWidth / window.innerHeight
    this.camera = new THREE.PerspectiveCamera(
      CONFIG.camera.fov,
      aspect,
      CONFIG.camera.near,
      CONFIG.camera.far
    )
    this.camera.position.set(
      CONFIG.camera.position.x,
      CONFIG.camera.position.y,
      CONFIG.camera.position.z
    )
    this.camera.lookAt(
      CONFIG.camera.lookAt.x,
      CONFIG.camera.lookAt.y,
      CONFIG.camera.lookAt.z
    )

    // Initialize renderer
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: CONFIG.rendering.antialias,
      alpha: CONFIG.rendering.alpha,
      powerPreference: CONFIG.rendering.powerPreference
    })
    this.renderer.setSize(window.innerWidth, window.innerHeight)
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, CONFIG.rendering.maxPixelRatio))

    // Set up lights
    this.setupLights()

    // Scene helpers
    this.gridHelper = new THREE.GridHelper(10, 20, 0x2a3442, 0x1a212c)
    this.gridHelper.position.y = -1.2
    this.scene.add(this.gridHelper)

    this.axesHelper = new THREE.AxesHelper(1.5)
    this.axesHelper.visible = false
    this.scene.add(this.axesHelper)

    // Handle window resize
    window.addEventListener('resize', this.boundHandleResize)
  }

  private setupLights(): void {
    // Ambient light
    const ambientLight = new THREE.AmbientLight(
      CONFIG.lighting.ambient.color,
      CONFIG.lighting.ambient.intensity
    )
    this.scene.add(ambientLight)

    // Directional light
    const directionalLight = new THREE.DirectionalLight(
      CONFIG.lighting.directional.color,
      CONFIG.lighting.directional.intensity
    )
    directionalLight.position.set(
      CONFIG.lighting.directional.position.x,
      CONFIG.lighting.directional.position.y,
      CONFIG.lighting.directional.position.z
    )
    this.scene.add(directionalLight)

    // Hemisphere light
    const hemisphereLight = new THREE.HemisphereLight(
      CONFIG.lighting.hemisphere.skyColor,
      CONFIG.lighting.hemisphere.groundColor,
      CONFIG.lighting.hemisphere.intensity
    )
    this.scene.add(hemisphereLight)
  }

  private handleResize(): void {
    const width = window.innerWidth
    const height = window.innerHeight

    this.camera.aspect = width / height
    this.camera.updateProjectionMatrix()

    this.renderer.setSize(width, height)
  }

  public addModel(model: Model): void {
    this.model = model
    this.scene.add(model.object)
  }

  public removeModel(): void {
    if (this.model) {
      this.scene.remove(this.model.object)
      this.model = null
      this.selectedPart = null
    }
  }

  public setSelectedPart(part: ModelPart | null): void {
    this.selectedPart = part
  }

  public getSelectedPart(): ModelPart | null {
    return this.selectedPart
  }

  public getModel(): Model | null {
    return this.model
  }

  public getScene(): THREE.Scene {
    return this.scene
  }

  public getCamera(): THREE.PerspectiveCamera {
    return this.camera
  }

  public getRenderer(): THREE.WebGLRenderer {
    return this.renderer
  }

  public getFPS(): number {
    return this.fps
  }

  /**
   * Register a callback invoked once per rendered frame (delta in seconds)
   */
  public setUpdateCallback(callback: ((deltaSeconds: number) => void) | null): void {
    this.updateCallback = callback
  }

  /**
   * Show/hide the ground grid
   */
  public setGridVisible(visible: boolean): void {
    this.gridHelper.visible = visible
  }

  public isGridVisible(): boolean {
    return this.gridHelper.visible
  }

  /**
   * Show/hide the axes helper
   */
  public setAxesVisible(visible: boolean): void {
    this.axesHelper.visible = visible
  }

  public isAxesVisible(): boolean {
    return this.axesHelper.visible
  }

  /**
   * Capture the current view as a PNG data URL.
   * Renders immediately before reading so the buffer is fresh
   * (the drawing buffer is not preserved between frames).
   */
  public captureScreenshot(): string {
    this.renderer.render(this.scene, this.camera)
    return this.renderer.domElement.toDataURL('image/png')
  }

  private updateFPS(): void {
    this.frameCount++

    const currentTime = performance.now()
    if (this.lastFpsTime === 0) {
      this.lastFpsTime = currentTime
      return
    }

    const elapsed = currentTime - this.lastFpsTime

    // Update FPS every second
    if (elapsed >= 1000) {
      this.fps = Math.round((this.frameCount * 1000) / elapsed)
      this.frameCount = 0
      this.lastFpsTime = currentTime

      // Update UI
      const fpsElement = document.getElementById('status-fps')
      if (fpsElement) {
        fpsElement.textContent = this.fps.toString()
      }

      const debugFpsElement = document.getElementById('debug-fps')
      if (debugFpsElement) {
        debugFpsElement.textContent = this.fps.toString()
      }
    }
  }

  public startRenderLoop(): void {
    const render = (time: number) => {
      const deltaSeconds = this.lastRenderTime === 0
        ? 0
        : Math.min((time - this.lastRenderTime) / 1000, 0.1)
      this.lastRenderTime = time

      if (this.updateCallback) {
        this.updateCallback(deltaSeconds)
      }

      this.updateFPS()
      this.renderer.render(this.scene, this.camera)

      this.animationFrameId = requestAnimationFrame(render)
    }

    this.animationFrameId = requestAnimationFrame(render)
    console.log('Render loop started')
  }

  public stopRenderLoop(): void {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId)
      this.animationFrameId = null
      console.log('Render loop stopped')
    }
  }

  public dispose(): void {
    this.stopRenderLoop()
    this.renderer.dispose()
    window.removeEventListener('resize', this.boundHandleResize)
    console.log('SceneManager disposed')
  }
}
