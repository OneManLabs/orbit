/**
 * 3D Hand Manipulation System - Main Entry Point
 */

import * as THREE from 'three'
import { SceneManager } from './scene/SceneManager'
import { ModelGenerator } from './scene/ModelGenerator'
import { CameraController } from './scene/CameraController'
import { HandTrackingPipeline } from './core/HandTrackingPipeline'
import { FrameSmoother } from './core/FrameSmoother'
import { GestureRecognizer } from './core/GestureRecognizer'
import { GestureStateMachine } from './core/GestureStateMachine'
import { InteractionEngine } from './core/InteractionEngine'
import { HandTrackingVisualizer } from './ui/HandTrackingVisualizer'
import { ExplodeMode } from './manipulation/ExplodeMode'
import { IsolateMode } from './manipulation/IsolateMode'
import { GameMode } from './game/GameMode'
import { GameUI } from './game/GameUI'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { CONFIG } from './config'
import type { Model, ModelPart, HandFrameData, GestureResult, StateTransition } from './types'

console.log('3D Hand Manipulation System initializing...')

// Global references
let sceneManager: SceneManager | null = null
let cameraController: CameraController | null = null
let handPipeline: HandTrackingPipeline | null = null
let frameSmoother: FrameSmoother | null = null
let gestureRecognizer: GestureRecognizer | null = null
let stateMachine: GestureStateMachine | null = null
let interactionEngine: InteractionEngine | null = null
let handVisualizer: HandTrackingVisualizer | null = null
let explodeMode: ExplodeMode | null = null
let isolateMode: IsolateMode | null = null
let gameMode: GameMode | null = null
let isGameActive: boolean = false
let orbitControls: OrbitControls | null = null
let currentModel: string = 'drone'
let uploadedModel: Model | null = null
let autoRotate: boolean = false
let wireframe: boolean = false
let selectedListPart: ModelPart | null = null

const SETTINGS_KEY = '3d-hand-manipulation-settings'

interface PersistedSettings {
  theme?: string
  speed?: number
  grid?: boolean
  axes?: boolean
  autoRotate?: boolean
}

// ============================================================
// Small UI helpers
// ============================================================

function showToast(message: string, isError: boolean = false, durationMs: number = 2600): void {
  const container = document.getElementById('toast-container')
  if (!container) return

  const toast = document.createElement('div')
  toast.className = `toast${isError ? ' toast--error' : ''}`
  toast.textContent = message
  container.appendChild(toast)

  setTimeout(() => toast.remove(), durationMs)
}

function loadSettings(): PersistedSettings {
  try {
    return JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}')
  } catch {
    return {}
  }
}

function saveSettings(patch: Partial<PersistedSettings>): void {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({ ...loadSettings(), ...patch }))
  } catch {
    // localStorage unavailable (private mode etc.) - ignore
  }
}

function setSwitch(id: string, on: boolean): void {
  const el = document.getElementById(id)
  if (el) el.setAttribute('aria-checked', on ? 'true' : 'false')
}

function bindSwitch(id: string, getState: () => boolean, apply: (on: boolean) => void): void {
  const el = document.getElementById(id)
  if (!el) return
  el.addEventListener('click', () => {
    const next = !getState()
    apply(next)
    setSwitch(id, next)
  })
}

// ============================================================
// Model management
// ============================================================

function disposeModel(model: Model): void {
  model.object.traverse(obj => {
    const mesh = obj as THREE.Mesh
    if (mesh.geometry) mesh.geometry.dispose()
    const material = (mesh as THREE.Mesh).material
    if (Array.isArray(material)) {
      material.forEach(m => m.dispose())
    } else if (material) {
      material.dispose()
    }
  })
}

function updateModelStats(model: Model): void {
  let vertices = 0
  let triangles = 0

  model.object.traverse(obj => {
    const mesh = obj as THREE.Mesh
    if (mesh.isMesh && mesh.geometry) {
      const position = mesh.geometry.getAttribute('position')
      if (position) {
        vertices += position.count
        triangles += mesh.geometry.index
          ? mesh.geometry.index.count / 3
          : position.count / 3
      }
    }
  })

  const partsEl = document.getElementById('stats-parts')
  const trianglesEl = document.getElementById('stats-triangles')
  if (partsEl) partsEl.textContent = model.parts.length.toString()
  if (trianglesEl) trianglesEl.textContent = Math.round(triangles).toLocaleString()
}

function updatePartList(model: Model): void {
  const list = document.getElementById('part-list')
  if (!list) return

  list.innerHTML = ''
  selectedListPart = null

  if (model.parts.length === 0) {
    const empty = document.createElement('li')
    empty.className = 'part-list__empty'
    empty.textContent = 'No parts'
    list.appendChild(empty)
    return
  }

  model.parts.forEach(part => {
    const item = document.createElement('li')
    item.className = 'part-list__item'
    item.textContent = part.name.replace(/_/g, ' ')
    item.addEventListener('click', () => {
      const wasSelected = selectedListPart === part

      // Clear previous selection styling
      list.querySelectorAll('.part-list__item--selected')
        .forEach(el => el.classList.remove('part-list__item--selected'))

      if (wasSelected) {
        selectedListPart = null
        interactionEngine?.selectPart(null)
      } else {
        selectedListPart = part
        item.classList.add('part-list__item--selected')
        interactionEngine?.selectPart(part)
      }
    })
    list.appendChild(item)
  })
}

function setActiveModelButton(modelName: string): void {
  const switcher = document.getElementById('model-switcher')
  if (!switcher) return
  switcher.querySelectorAll('.segmented__item')
    .forEach(el => el.classList.remove('segmented__item--active'))
  const active = document.getElementById(`model-${modelName}`)
  active?.classList.add('segmented__item--active')
}

function applyWireframe(model: Model, enabled: boolean): void {
  model.object.traverse(obj => {
    const mesh = obj as THREE.Mesh
    if (mesh.isMesh && mesh.material) {
      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
      materials.forEach(m => {
        (m as THREE.MeshStandardMaterial).wireframe = enabled
      })
    }
  })
}

/**
 * Load a model by name
 */
async function loadModel(modelName: string): Promise<void> {
  if (!sceneManager) {
    console.error('SceneManager not initialized')
    return
  }

  let model: Model
  try {
    switch (modelName) {
      case 'drone':
        model = ModelGenerator.generateDrone()
        break
      case 'cube':
        model = ModelGenerator.generateCube()
        break
      case 'robot':
        model = ModelGenerator.generateRobot()
        break
      case 'spacecraft':
        model = ModelGenerator.generateSpacecraft()
        break
      case 'pcb':
        model = await ModelGenerator.loadSTL('/testpcb.stl')
        break
      case 'uploaded':
        if (!uploadedModel) {
          showToast('No uploaded model available', true)
          return
        }
        model = uploadedModel
        break
      default:
        console.error(`Unknown model: ${modelName}`)
        return
    }
  } catch (error) {
    showToast(`Failed to load ${modelName}: ${(error as Error).message}`, true)
    return
  }

  setModel(model, modelName)
}

/**
 * Install a model into the scene, replacing (and disposing) the old one
 */
function setModel(model: Model, modelName: string): void {
  if (!sceneManager) return

  // Remove and dispose old model
  const oldModel = sceneManager.getModel()
  interactionEngine?.clearHighlights()
  if (oldModel) {
    sceneManager.removeModel()
    if (oldModel !== uploadedModel) {
      disposeModel(oldModel)
    }
  }

  // Add new model
  sceneManager.addModel(model)
  console.log(`✓ ${modelName} model loaded: ${model.parts.length} parts`)

  // Update dependent systems and UI
  explodeMode?.setModel(model)
  isolateMode?.setModel(model)
  applyWireframe(model, wireframe)
  updateModelStats(model)
  updatePartList(model)
  setActiveModelButton(modelName)
  resetExplodeUI()
  resetIsolateUI()

  currentModel = modelName
}

function resetExplodeUI(): void {
  const explodeSlider = document.getElementById('explode-slider') as HTMLInputElement | null
  const explodeValue = document.getElementById('explode-value')
  if (explodeSlider) explodeSlider.value = '0'
  if (explodeValue) explodeValue.textContent = '0%'
}

function resetIsolateUI(): void {
  const isolateToggle = document.getElementById('isolate-toggle')
  if (isolateToggle) isolateToggle.textContent = 'Isolate Selected'
}

// ============================================================
// Initialization
// ============================================================

async function initialize(): Promise<void> {
  try {
    const canvas = document.getElementById('three-canvas') as HTMLCanvasElement
    if (!canvas) {
      throw new Error('Canvas element not found')
    }

    sceneManager = new SceneManager(canvas)
    explodeMode = new ExplodeMode()
    isolateMode = new IsolateMode()

    // Interaction engine before first model load so highlights/UI wire up
    interactionEngine = new InteractionEngine(sceneManager)

    // Restore persisted settings
    const settings = loadSettings()
    if (settings.theme && settings.theme !== 'cyan') {
      applyTheme(settings.theme)
    }
    if (settings.grid === false) sceneManager.setGridVisible(false)
    if (settings.axes === true) sceneManager.setAxesVisible(true)
    if (settings.autoRotate === true) autoRotate = true
    if (typeof settings.speed === 'number') {
      // @ts-ignore - mutable at runtime
      CONFIG.manipulation.speedMultiplier = settings.speed
    }
    setSwitch('toggle-grid', sceneManager.isGridVisible())
    setSwitch('toggle-axes', sceneManager.isAxesVisible())
    setSwitch('toggle-autorotate', autoRotate)

    // Generate default model
    await loadModel('drone')

    // Camera + orbit controls
    cameraController = new CameraController(sceneManager.getCamera())
    orbitControls = new OrbitControls(sceneManager.getCamera(), canvas)
    orbitControls.enableDamping = true
    orbitControls.dampingFactor = 0.05
    orbitControls.target.set(0, 0, 0)

    // Per-frame update: orbit damping + auto-rotate (single rAF loop)
    sceneManager.setUpdateCallback((delta) => {
      orbitControls?.update()
      if (autoRotate && !isGameActive) {
        const model = sceneManager?.getModel()
        if (model) {
          model.object.rotation.y += delta * 0.5
        }
      }
    })

    sceneManager.startRenderLoop()

    setupUIControls()

    console.log('✅ 3D scene initialized')

    await initializeHandTracking()

  } catch (error) {
    console.error('❌ Initialization failed:', error)
    showToast(`Initialization failed: ${(error as Error).message}`, true, 8000)
  }
}

/**
 * Initialize hand tracking pipeline
 */
async function initializeHandTracking(): Promise<void> {
  try {
    if (!sceneManager || !interactionEngine) {
      throw new Error('Scene must be initialized first')
    }

    gameMode = new GameMode(sceneManager, interactionEngine)
    frameSmoother = new FrameSmoother()
    gestureRecognizer = new GestureRecognizer()
    stateMachine = new GestureStateMachine()

    handPipeline = new HandTrackingPipeline()
    await handPipeline.initialize()

    // Set up frame callback
    handPipeline.onFrame((frameData: HandFrameData) => {
      const smoothedData = frameSmoother!.smooth(frameData)
      const gesture: GestureResult = gestureRecognizer!.recognize(smoothedData)
      const transition: StateTransition = stateMachine!.update(gesture, smoothedData)

      interactionEngine!.update(smoothedData, gesture, transition)

      if (gameMode && isGameActive) {
        gameMode.update(smoothedData, gesture, transition)
      }

      if (handVisualizer) {
        handVisualizer.update(smoothedData)
      }

      updateDebugPanel(smoothedData, gesture, transition)

      // Update mode display (selected part is managed by InteractionEngine)
      const modeElement = document.getElementById('status-mode')
      if (modeElement) {
        modeElement.textContent = transition.currentState
      }
    })

    await handPipeline.start()

    const videoElement = handPipeline.getVideoElement()
    if (videoElement) {
      handVisualizer = new HandTrackingVisualizer(videoElement)
      handVisualizer.show()
    }

    console.log('✅ Hand tracking ready. Show your hand to the camera.')

  } catch (error) {
    console.error('❌ Hand tracking initialization failed:', error)
    showToast(
      `Hand tracking unavailable: ${(error as Error).message} — mouse controls still work.`,
      true,
      8000
    )

    const statusElement = document.getElementById('hand-tracking-status')
    const textElement = document.getElementById('hand-tracking-text')
    if (statusElement && textElement) {
      statusElement.classList.add('status-indicator--error')
      statusElement.classList.remove('status-indicator--active')
      textElement.textContent = 'Disabled'
    }
  }
}

// ============================================================
// UI wiring
// ============================================================

function applyTheme(theme: string): void {
  // Must live on <html> so the :root-defined color variables recompute
  document.documentElement.setAttribute('data-theme', theme)
  const switcher = document.getElementById('theme-switcher')
  switcher?.querySelectorAll('.swatch').forEach(el => {
    el.classList.toggle('swatch--active', el.getAttribute('data-theme') === theme)
  })
  saveSettings({ theme })
}

function resetCamera(): void {
  cameraController?.reset()
  orbitControls?.target.set(0, 0, 0)
}

function setCameraPreset(position: THREE.Vector3): void {
  if (!sceneManager) return
  sceneManager.getCamera().position.copy(position)
  sceneManager.getCamera().lookAt(0, 0, 0)
  orbitControls?.target.set(0, 0, 0)
}

function resetTransforms(kind: 'rotation' | 'position' | 'scale' | 'all'): void {
  const model = sceneManager?.getModel()
  if (!model) return

  model.parts.forEach(part => {
    if (kind === 'rotation' || kind === 'all') {
      part.mesh.rotation.copy(part.originalRotation)
    }
    if (kind === 'position' || kind === 'all') {
      part.mesh.position.copy(part.originalPosition)
    }
    if (kind === 'scale' || kind === 'all') {
      part.mesh.scale.copy(part.originalScale)
    }
  })

  if (kind === 'all') {
    // Also clear group-level auto-rotation and modes
    model.object.rotation.set(0, 0, 0)
    explodeMode?.reset()
    isolateMode?.unIsolate()
    resetExplodeUI()
    resetIsolateUI()
  }
}

function toggleIsolation(): void {
  if (!isolateMode) return

  const isolateToggle = document.getElementById('isolate-toggle')

  if (isolateMode.getIsActive()) {
    isolateMode.unIsolate()
    if (isolateToggle) isolateToggle.textContent = 'Isolate Selected'
  } else {
    const part = selectedListPart || interactionEngine?.getSelectedPart()
    if (part) {
      isolateMode.isolate(part)
      if (isolateToggle) isolateToggle.textContent = 'Show All Parts'
    } else {
      showToast('Select a part first (click one in the Parts list)')
    }
  }
}

function toggleWireframe(): void {
  wireframe = !wireframe
  const model = sceneManager?.getModel()
  if (model) applyWireframe(model, wireframe)
  setSwitch('toggle-wireframe', wireframe)
}

function toggleAutoRotate(): void {
  autoRotate = !autoRotate
  setSwitch('toggle-autorotate', autoRotate)
  saveSettings({ autoRotate })
}

function toggleGrid(): void {
  if (!sceneManager) return
  const next = !sceneManager.isGridVisible()
  sceneManager.setGridVisible(next)
  setSwitch('toggle-grid', next)
  saveSettings({ grid: next })
}

function takeScreenshot(): void {
  if (!sceneManager) return
  try {
    const dataUrl = sceneManager.captureScreenshot()
    const link = document.createElement('a')
    link.href = dataUrl
    link.download = `3d-capture-${new Date().toISOString().replace(/[:.]/g, '-')}.png`
    link.click()
    showToast('Screenshot saved')
  } catch (error) {
    showToast(`Screenshot failed: ${(error as Error).message}`, true)
  }
}

function loadSTLBuffer(buffer: ArrayBuffer, fileName: string): void {
  try {
    const name = fileName.replace(/\.stl$/i, '') || 'Uploaded'
    const model = ModelGenerator.loadSTLFromBuffer(buffer, name)

    // Dispose a previously uploaded model that is no longer in the scene
    if (uploadedModel && sceneManager?.getModel() !== uploadedModel) {
      disposeModel(uploadedModel)
    }
    uploadedModel = model
    setModel(model, 'uploaded')
    showToast(`Loaded ${fileName} (${model.parts.length} part)`)
  } catch (error) {
    showToast(`Could not parse STL: ${(error as Error).message}`, true)
  }
}

function toggleHelp(forceShow?: boolean): void {
  const overlay = document.getElementById('help-overlay')
  if (!overlay) return
  const show = forceShow !== undefined ? forceShow : overlay.style.display === 'none'
  overlay.style.display = show ? 'flex' : 'none'
}

function exitGame(): void {
  if (!gameMode || !isGameActive) return

  gameMode.endGame()
  isGameActive = false
  GameUI.hideGameHUD()

  const startBtn = document.getElementById('game-start')
  const pauseBtn = document.getElementById('game-pause')
  const restartBtn = document.getElementById('game-restart')
  const exitBtn = document.getElementById('game-exit')
  if (startBtn) startBtn.style.display = 'block'
  if (pauseBtn) { pauseBtn.style.display = 'none'; pauseBtn.textContent = 'Pause' }
  if (restartBtn) restartBtn.style.display = 'none'
  if (exitBtn) exitBtn.style.display = 'none'

  // Restore the model that was loaded before the game started
  loadModel(currentModel)
}

function setupUIControls(): void {
  // --- Camera ---
  document.getElementById('reset-camera')?.addEventListener('click', resetCamera)
  document.getElementById('view-front')?.addEventListener('click', () => setCameraPreset(new THREE.Vector3(0, 0, 5)))
  document.getElementById('view-top')?.addEventListener('click', () => setCameraPreset(new THREE.Vector3(0, 5, 0.01)))
  document.getElementById('view-side')?.addEventListener('click', () => setCameraPreset(new THREE.Vector3(5, 0, 0)))
  document.getElementById('view-iso')?.addEventListener('click', () => setCameraPreset(new THREE.Vector3(3.2, 2.6, 3.2)))
  document.getElementById('screenshot')?.addEventListener('click', takeScreenshot)

  // --- View toggles ---
  bindSwitch('toggle-grid', () => sceneManager?.isGridVisible() ?? true, (on) => {
    sceneManager?.setGridVisible(on)
    saveSettings({ grid: on })
  })
  bindSwitch('toggle-axes', () => sceneManager?.isAxesVisible() ?? false, (on) => {
    sceneManager?.setAxesVisible(on)
    saveSettings({ axes: on })
  })
  bindSwitch('toggle-wireframe', () => wireframe, (on) => {
    wireframe = on
    const model = sceneManager?.getModel()
    if (model) applyWireframe(model, wireframe)
  })
  bindSwitch('toggle-autorotate', () => autoRotate, (on) => {
    autoRotate = on
    saveSettings({ autoRotate: on })
  })

  // --- Transform resets ---
  document.getElementById('reset-rotation')?.addEventListener('click', () => resetTransforms('rotation'))
  document.getElementById('reset-position')?.addEventListener('click', () => resetTransforms('position'))
  document.getElementById('reset-scale')?.addEventListener('click', () => resetTransforms('scale'))
  document.getElementById('reset-all')?.addEventListener('click', () => {
    resetTransforms('all')
    resetCamera()
  })

  // --- Explode slider ---
  const explodeSlider = document.getElementById('explode-slider') as HTMLInputElement | null
  const explodeValue = document.getElementById('explode-value')
  explodeSlider?.addEventListener('input', (e) => {
    const value = (e.target as HTMLInputElement).value
    const factor = parseInt(value) / 100
    if (explodeValue) explodeValue.textContent = `${value}%`
    explodeMode?.setExplodeFactor(factor)
  })

  // --- Speed slider ---
  const speedSlider = document.getElementById('speed-slider') as HTMLInputElement | null
  const speedValue = document.getElementById('speed-value')
  if (speedSlider) {
    // Restore persisted value into the UI
    // @ts-ignore - mutable at runtime
    const current: number = CONFIG.manipulation.speedMultiplier
    speedSlider.value = Math.round(current * 100).toString()
    if (speedValue) speedValue.textContent = `${current.toFixed(1)}x`

    speedSlider.addEventListener('input', (e) => {
      const value = (e.target as HTMLInputElement).value
      const speedMultiplier = parseInt(value) / 100
      if (speedValue) speedValue.textContent = `${speedMultiplier.toFixed(1)}x`
      // @ts-ignore - mutable at runtime
      CONFIG.manipulation.speedMultiplier = speedMultiplier
      saveSettings({ speed: speedMultiplier })
    })
  }

  // --- Isolation ---
  document.getElementById('isolate-toggle')?.addEventListener('click', toggleIsolation)

  // --- Model selection ---
  const modelButtons = ['drone', 'cube', 'robot', 'spacecraft', 'pcb']
  modelButtons.forEach(model => {
    document.getElementById(`model-${model}`)?.addEventListener('click', async () => {
      if (isGameActive) exitGame()
      await loadModel(model)
    })
  })

  // --- STL upload ---
  const fileInput = document.getElementById('stl-file-input') as HTMLInputElement | null
  document.getElementById('model-upload')?.addEventListener('click', () => fileInput?.click())
  fileInput?.addEventListener('change', async () => {
    const file = fileInput.files?.[0]
    if (!file) return
    loadSTLBuffer(await file.arrayBuffer(), file.name)
    fileInput.value = ''
  })

  // --- Drag & drop STL ---
  const dropOverlay = document.getElementById('drop-overlay')
  let dragDepth = 0
  window.addEventListener('dragenter', (e) => {
    e.preventDefault()
    dragDepth++
    if (dropOverlay) dropOverlay.hidden = false
  })
  window.addEventListener('dragleave', (e) => {
    e.preventDefault()
    dragDepth = Math.max(0, dragDepth - 1)
    if (dragDepth === 0 && dropOverlay) dropOverlay.hidden = true
  })
  window.addEventListener('dragover', (e) => e.preventDefault())
  window.addEventListener('drop', async (e) => {
    e.preventDefault()
    dragDepth = 0
    if (dropOverlay) dropOverlay.hidden = true

    const file = e.dataTransfer?.files?.[0]
    if (!file) return
    if (!file.name.toLowerCase().endsWith('.stl')) {
      showToast('Only STL files are supported', true)
      return
    }
    loadSTLBuffer(await file.arrayBuffer(), file.name)
  })

  // --- Theme switcher ---
  document.getElementById('theme-switcher')?.querySelectorAll('.swatch').forEach(swatch => {
    swatch.addEventListener('click', () => {
      const theme = swatch.getAttribute('data-theme')
      if (theme) applyTheme(theme)
    })
  })

  // --- Help ---
  document.getElementById('help-toggle')?.addEventListener('click', () => toggleHelp())
  document.getElementById('help-close')?.addEventListener('click', () => toggleHelp(false))
  document.getElementById('help-overlay')?.addEventListener('click', (e) => {
    if (e.target === e.currentTarget) toggleHelp(false)
  })

  // --- Game controls ---
  const gameStartBtn = document.getElementById('game-start')
  gameStartBtn?.addEventListener('click', () => {
    if (!gameMode) {
      showToast('Game requires hand tracking', true)
      return
    }
    if (isGameActive) return

    sceneManager?.removeModel()
    interactionEngine?.clearHighlights()
    gameMode.startGame()
    isGameActive = true

    GameUI.showGameHUD()
    gameStartBtn.style.display = 'none'
    const pauseBtn = document.getElementById('game-pause')
    const restartBtn = document.getElementById('game-restart')
    const exitBtn = document.getElementById('game-exit')
    if (pauseBtn) pauseBtn.style.display = 'block'
    if (restartBtn) restartBtn.style.display = 'block'
    if (exitBtn) exitBtn.style.display = 'block'
  })

  const gamePauseBtn = document.getElementById('game-pause')
  gamePauseBtn?.addEventListener('click', () => {
    if (gameMode && isGameActive) {
      if (gameMode.isPaused()) {
        gameMode.resumeGame()
        gamePauseBtn.textContent = 'Pause'
      } else {
        gameMode.pauseGame()
        gamePauseBtn.textContent = 'Resume'
      }
    }
  })

  document.getElementById('game-restart')?.addEventListener('click', () => {
    if (gameMode && isGameActive) {
      gameMode.endGame()
      gameMode.startGame()
      const pauseBtn = document.getElementById('game-pause')
      if (pauseBtn) pauseBtn.textContent = 'Pause'
    }
  })

  document.getElementById('game-exit')?.addEventListener('click', exitGame)

  // --- Keyboard shortcuts ---
  const debugOverlay = document.getElementById('debug-overlay')
  document.addEventListener('keydown', (e) => {
    // Ignore when typing into inputs
    const tag = (e.target as HTMLElement)?.tagName
    if (tag === 'INPUT' || tag === 'TEXTAREA') return

    switch (e.key.toLowerCase()) {
      case 'd':
        if (debugOverlay) {
          debugOverlay.style.display = debugOverlay.style.display === 'none' ? 'block' : 'none'
        }
        break

      case 'r':
        interactionEngine?.resetSelectedPart()
        break

      case 'c':
        resetCamera()
        break

      case 'e': {
        if (!explodeMode) break
        const newFactor = explodeMode.getExplodeFactor() > 0 ? 0 : 1
        explodeMode.setExplodeFactor(newFactor)
        if (explodeSlider) explodeSlider.value = (newFactor * 100).toString()
        if (explodeValue) explodeValue.textContent = `${newFactor * 100}%`
        break
      }

      case 'i':
        toggleIsolation()
        break

      case 'w':
        toggleWireframe()
        break

      case 'g':
        toggleGrid()
        break

      case 'a':
        toggleAutoRotate()
        break

      case '?':
        toggleHelp()
        break

      case 'escape':
        toggleHelp(false)
        break
    }
  })
}

/**
 * Update debug panel with hand tracking data
 */
function updateDebugPanel(
  frameData: HandFrameData,
  gesture?: GestureResult,
  transition?: StateTransition
): void {
  const handsElement = document.getElementById('debug-hands')
  if (handsElement) {
    handsElement.textContent = frameData.hands.length.toString()
  }

  const confidenceElement = document.getElementById('debug-confidence')
  if (confidenceElement) {
    confidenceElement.textContent = `${Math.round(frameData.confidence * 100)}%`
  }

  const landmarksElement = document.getElementById('debug-landmarks')
  if (landmarksElement) {
    landmarksElement.textContent = frameData.hands.length > 0
      ? `${frameData.hands[0].landmarks.length}/21`
      : '0/21'
  }

  const stateElement = document.getElementById('debug-state')
  if (stateElement && transition) {
    stateElement.textContent = transition.currentState
  }

  const gestureElement = document.getElementById('debug-gesture')
  if (gestureElement && gesture) {
    gestureElement.textContent = gesture.confidence > 0.5
      ? `${gesture.type} (${Math.round(gesture.confidence * 100)}%)`
      : 'None'
  }
}

// Initialize on DOM ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initialize)
} else {
  initialize()
}
