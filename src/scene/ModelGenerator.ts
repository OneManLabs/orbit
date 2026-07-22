/**
 * ModelGenerator - Programmatic creation of multi-part drone model
 */

import * as THREE from 'three'
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js'
import { CONFIG } from '../config'
import type { Model, ModelPart } from '../types'

export class ModelGenerator {
  /**
   * Load an STL file and convert to Model
   */
  public static async loadSTL(path: string): Promise<Model> {
    return new Promise((resolve, reject) => {
      const loader = new STLLoader()

      loader.load(
        path,
        (geometry) => {
          resolve(this.geometryToModel(geometry, 'STL_Model'))
        },
        undefined,
        (error) => {
          console.error('Error loading STL:', error)
          reject(error)
        }
      )
    })
  }

  /**
   * Load an STL from an in-memory buffer (file upload / drag & drop)
   */
  public static loadSTLFromBuffer(buffer: ArrayBuffer, name: string = 'STL_Model'): Model {
    const loader = new STLLoader()
    const geometry = loader.parse(buffer)
    return this.geometryToModel(geometry, name)
  }

  /**
   * Wrap a raw STL geometry into a centered, scaled Model
   */
  private static geometryToModel(geometry: THREE.BufferGeometry, name: string): Model {
    // Center the geometry
    geometry.computeBoundingBox()
    const boundingBox = geometry.boundingBox!
    const center = new THREE.Vector3()
    boundingBox.getCenter(center)
    geometry.translate(-center.x, -center.y, -center.z)

    // Calculate scale to fit in reasonable size (target: ~2 units)
    const size = new THREE.Vector3()
    boundingBox.getSize(size)
    const maxDimension = Math.max(size.x, size.y, size.z)
    const targetSize = 2.0
    const scale = targetSize / maxDimension

    // Create material
    const material = new THREE.MeshStandardMaterial({
      color: 0x2a8f5f,
      metalness: 0.6,
      roughness: 0.4,
      flatShading: false
    })

    // Compute normals for smooth shading
    geometry.computeVertexNormals()

    // Create mesh
    const mesh = new THREE.Mesh(geometry, material)
    mesh.scale.set(scale, scale, scale)
    mesh.rotation.x = -Math.PI / 2  // Rotate to standard orientation (many STLs are rotated)
    mesh.name = name

    // Create group
    const group = new THREE.Group()
    group.add(mesh)

    // Create single part (STL is treated as one piece)
    const part: ModelPart = {
      mesh,
      name,
      originalPosition: mesh.position.clone(),
      originalRotation: mesh.rotation.clone(),
      originalScale: mesh.scale.clone()
    }

    return {
      object: group,
      parts: [part],
      boundingBox: new THREE.Box3().setFromObject(group)
    }
  }
  /**
   * Generate a complete drone model with multiple parts
   */
  public static generateDrone(): Model {
    const group = new THREE.Group()
    const parts: ModelPart[] = []

    // Create body (center box)
    const body = this.createBody()
    group.add(body.mesh)
    parts.push(body)

    // Create 4 arms (extending from body in + pattern)
    const armPositions = [
      { x: 1, z: 0, rotation: 0, name: 'Arm_Front' },
      { x: -1, z: 0, rotation: Math.PI, name: 'Arm_Back' },
      { x: 0, z: 1, rotation: Math.PI / 2, name: 'Arm_Right' },
      { x: 0, z: -1, rotation: -Math.PI / 2, name: 'Arm_Left' }
    ]

    armPositions.forEach((pos, index) => {
      const arm = this.createArm(pos.x, pos.z, pos.rotation, pos.name)
      group.add(arm.mesh)
      parts.push(arm)

      // Add motor and propeller at end of each arm
      const motor = this.createMotor(pos.x, pos.z, `Motor_${index}`)
      group.add(motor.mesh)
      parts.push(motor)

      const propeller = this.createPropeller(pos.x, pos.z, `Propeller_${index}`)
      group.add(propeller.mesh)
      parts.push(propeller)
    })

    // Calculate bounding box
    const boundingBox = new THREE.Box3().setFromObject(group)

    console.log(`Drone model generated: ${parts.length} parts`)

    return {
      object: group,
      parts,
      boundingBox
    }
  }

  /**
   * Create the central body of the drone
   */
  private static createBody(): ModelPart {
    const geometry = new THREE.BoxGeometry(
      CONFIG.model.body.width,
      CONFIG.model.body.height,
      CONFIG.model.body.depth
    )

    const material = new THREE.MeshStandardMaterial({
      color: CONFIG.model.body.color,
      metalness: CONFIG.model.material.metalness,
      roughness: CONFIG.model.material.roughness
    })

    const mesh = new THREE.Mesh(geometry, material)
    mesh.name = 'Body'
    mesh.position.set(0, 0, 0)

    return {
      mesh,
      name: 'Body',
      originalPosition: mesh.position.clone(),
      originalRotation: mesh.rotation.clone(),
      originalScale: mesh.scale.clone()
    }
  }

  /**
   * Create an arm extending from the body
   */
  private static createArm(x: number, z: number, rotation: number, name: string): ModelPart {
    const geometry = new THREE.CylinderGeometry(
      CONFIG.model.arm.radius,
      CONFIG.model.arm.radius,
      CONFIG.model.arm.length,
      8
    )

    const material = new THREE.MeshStandardMaterial({
      color: CONFIG.model.arm.color,
      metalness: CONFIG.model.material.metalness,
      roughness: CONFIG.model.material.roughness
    })

    const mesh = new THREE.Mesh(geometry, material)
    mesh.name = name

    // Position and rotate arm
    const armLength = CONFIG.model.arm.length
    mesh.position.set(
      x * (armLength / 2 + CONFIG.model.body.width / 2),
      0,
      z * (armLength / 2 + CONFIG.model.body.depth / 2)
    )

    // Rotate to align with direction
    if (x !== 0) {
      mesh.rotation.z = Math.PI / 2
    } else {
      mesh.rotation.x = Math.PI / 2
    }

    return {
      mesh,
      name,
      originalPosition: mesh.position.clone(),
      originalRotation: mesh.rotation.clone(),
      originalScale: mesh.scale.clone()
    }
  }

  /**
   * Create a motor at the end of an arm
   */
  private static createMotor(x: number, z: number, name: string): ModelPart {
    const geometry = new THREE.CylinderGeometry(
      CONFIG.model.motor.radius,
      CONFIG.model.motor.radius,
      CONFIG.model.motor.height,
      16
    )

    const material = new THREE.MeshStandardMaterial({
      color: CONFIG.model.motor.color,
      metalness: CONFIG.model.material.metalness + 0.1,  // More metallic
      roughness: CONFIG.model.material.roughness - 0.1
    })

    const mesh = new THREE.Mesh(geometry, material)
    mesh.name = name

    // Position at end of arm
    const armLength = CONFIG.model.arm.length
    mesh.position.set(
      x * (armLength + CONFIG.model.body.width / 2),
      CONFIG.model.motor.height / 2,
      z * (armLength + CONFIG.model.body.depth / 2)
    )

    return {
      mesh,
      name,
      originalPosition: mesh.position.clone(),
      originalRotation: mesh.rotation.clone(),
      originalScale: mesh.scale.clone()
    }
  }

  /**
   * Create a propeller above a motor
   */
  private static createPropeller(x: number, z: number, name: string): ModelPart {
    // Create propeller as two blades in a cross pattern
    const bladeGeometry = new THREE.BoxGeometry(
      CONFIG.model.propeller.radius * 2,
      CONFIG.model.propeller.thickness,
      CONFIG.model.propeller.radius * 0.2
    )

    const bladeMaterial = new THREE.MeshStandardMaterial({
      color: CONFIG.model.propeller.color,
      metalness: 0.8,
      roughness: 0.2,
      emissive: CONFIG.model.propeller.color,
      emissiveIntensity: 0.1  // Subtle glow
    })

    // Create group for both blades
    const group = new THREE.Group()

    for (let i = 0; i < CONFIG.model.propeller.bladeCount; i++) {
      const blade = new THREE.Mesh(bladeGeometry, bladeMaterial.clone())
      blade.rotation.y = (i * Math.PI) / CONFIG.model.propeller.bladeCount
      group.add(blade)
    }

    // Position above motor
    const armLength = CONFIG.model.arm.length
    group.position.set(
      x * (armLength + CONFIG.model.body.width / 2),
      CONFIG.model.motor.height + CONFIG.model.propeller.thickness,
      z * (armLength + CONFIG.model.body.depth / 2)
    )

    // Create a single mesh to represent the propeller group
    const mesh = group as any as THREE.Mesh
    mesh.name = name

    return {
      mesh,
      name,
      originalPosition: group.position.clone(),
      originalRotation: group.rotation.clone(),
      originalScale: group.scale.clone()
    }
  }

  /**
   * Generate a simple cube model
   */
  public static generateCube(): Model {
    const group = new THREE.Group()
    const parts: ModelPart[] = []

    const geometry = new THREE.BoxGeometry(1, 1, 1)
    const material = new THREE.MeshStandardMaterial({
      color: 0xff6b35,  // Orange
      metalness: 0.5,
      roughness: 0.5
    })

    const mesh = new THREE.Mesh(geometry, material)
    mesh.name = 'Cube'

    group.add(mesh)
    parts.push({
      mesh,
      name: 'Cube',
      originalPosition: mesh.position.clone(),
      originalRotation: mesh.rotation.clone(),
      originalScale: mesh.scale.clone()
    })

    const boundingBox = new THREE.Box3().setFromObject(group)

    return { object: group, parts, boundingBox }
  }

  /**
   * Generate a robot-like model
   */
  public static generateRobot(): Model {
    const group = new THREE.Group()
    const parts: ModelPart[] = []

    // Head
    const headGeometry = new THREE.BoxGeometry(0.5, 0.5, 0.5)
    const headMaterial = new THREE.MeshStandardMaterial({
      color: 0x4ecdc4,  // Teal
      metalness: 0.7,
      roughness: 0.3
    })
    const head = new THREE.Mesh(headGeometry, headMaterial)
    head.position.set(0, 1.25, 0)
    head.name = 'Head'
    group.add(head)
    parts.push({
      mesh: head,
      name: 'Head',
      originalPosition: head.position.clone(),
      originalRotation: head.rotation.clone(),
      originalScale: head.scale.clone()
    })

    // Body
    const bodyGeometry = new THREE.BoxGeometry(0.7, 1.0, 0.4)
    const bodyMaterial = new THREE.MeshStandardMaterial({
      color: 0x556270,  // Dark gray
      metalness: 0.7,
      roughness: 0.3
    })
    const body = new THREE.Mesh(bodyGeometry, bodyMaterial)
    body.position.set(0, 0.5, 0)
    body.name = 'Body'
    group.add(body)
    parts.push({
      mesh: body,
      name: 'Body',
      originalPosition: body.position.clone(),
      originalRotation: body.rotation.clone(),
      originalScale: body.scale.clone()
    })

    // Arms
    const armGeometry = new THREE.CylinderGeometry(0.1, 0.1, 0.8, 8)
    const armMaterial = new THREE.MeshStandardMaterial({
      color: 0xc7f464,  // Light green
      metalness: 0.6,
      roughness: 0.4
    })

    const leftArm = new THREE.Mesh(armGeometry, armMaterial)
    leftArm.position.set(-0.5, 0.5, 0)
    leftArm.name = 'Left_Arm'
    group.add(leftArm)
    parts.push({
      mesh: leftArm,
      name: 'Left_Arm',
      originalPosition: leftArm.position.clone(),
      originalRotation: leftArm.rotation.clone(),
      originalScale: leftArm.scale.clone()
    })

    const rightArm = new THREE.Mesh(armGeometry, armMaterial.clone())
    rightArm.position.set(0.5, 0.5, 0)
    rightArm.name = 'Right_Arm'
    group.add(rightArm)
    parts.push({
      mesh: rightArm,
      name: 'Right_Arm',
      originalPosition: rightArm.position.clone(),
      originalRotation: rightArm.rotation.clone(),
      originalScale: rightArm.scale.clone()
    })

    // Legs
    const legGeometry = new THREE.CylinderGeometry(0.12, 0.12, 0.8, 8)
    const legMaterial = new THREE.MeshStandardMaterial({
      color: 0xff6b6b,  // Red
      metalness: 0.6,
      roughness: 0.4
    })

    const leftLeg = new THREE.Mesh(legGeometry, legMaterial)
    leftLeg.position.set(-0.2, -0.4, 0)
    leftLeg.name = 'Left_Leg'
    group.add(leftLeg)
    parts.push({
      mesh: leftLeg,
      name: 'Left_Leg',
      originalPosition: leftLeg.position.clone(),
      originalRotation: leftLeg.rotation.clone(),
      originalScale: leftLeg.scale.clone()
    })

    const rightLeg = new THREE.Mesh(legGeometry, legMaterial.clone())
    rightLeg.position.set(0.2, -0.4, 0)
    rightLeg.name = 'Right_Leg'
    group.add(rightLeg)
    parts.push({
      mesh: rightLeg,
      name: 'Right_Leg',
      originalPosition: rightLeg.position.clone(),
      originalRotation: rightLeg.rotation.clone(),
      originalScale: rightLeg.scale.clone()
    })

    const boundingBox = new THREE.Box3().setFromObject(group)

    console.log(`Robot model generated: ${parts.length} parts`)

    return { object: group, parts, boundingBox }
  }

  /**
   * Generate a spacecraft model
   */
  public static generateSpacecraft(): Model {
    const group = new THREE.Group()
    const parts: ModelPart[] = []

    // Main fuselage
    const fuselageGeometry = new THREE.CylinderGeometry(0.3, 0.2, 1.5, 16)
    const fuselageMaterial = new THREE.MeshStandardMaterial({
      color: 0xe8e8e8,  // Light gray
      metalness: 0.8,
      roughness: 0.2
    })
    const fuselage = new THREE.Mesh(fuselageGeometry, fuselageMaterial)
    fuselage.rotation.x = Math.PI / 2
    fuselage.name = 'Fuselage'
    group.add(fuselage)
    parts.push({
      mesh: fuselage,
      name: 'Fuselage',
      originalPosition: fuselage.position.clone(),
      originalRotation: fuselage.rotation.clone(),
      originalScale: fuselage.scale.clone()
    })

    // Cockpit
    const cockpitGeometry = new THREE.SphereGeometry(0.35, 16, 16)
    const cockpitMaterial = new THREE.MeshStandardMaterial({
      color: 0x00d9ff,  // Cyan
      metalness: 0.9,
      roughness: 0.1,
      emissive: 0x00d9ff,
      emissiveIntensity: 0.2
    })
    const cockpit = new THREE.Mesh(cockpitGeometry, cockpitMaterial)
    cockpit.position.set(0, 0, 0.8)
    cockpit.scale.set(1, 0.8, 1.2)
    cockpit.name = 'Cockpit'
    group.add(cockpit)
    parts.push({
      mesh: cockpit,
      name: 'Cockpit',
      originalPosition: cockpit.position.clone(),
      originalRotation: cockpit.rotation.clone(),
      originalScale: cockpit.scale.clone()
    })

    // Wings
    const wingGeometry = new THREE.BoxGeometry(2.0, 0.05, 0.6)
    const wingMaterial = new THREE.MeshStandardMaterial({
      color: 0xff4757,  // Red
      metalness: 0.7,
      roughness: 0.3
    })
    const wings = new THREE.Mesh(wingGeometry, wingMaterial)
    wings.position.set(0, 0, -0.2)
    wings.name = 'Wings'
    group.add(wings)
    parts.push({
      mesh: wings,
      name: 'Wings',
      originalPosition: wings.position.clone(),
      originalRotation: wings.rotation.clone(),
      originalScale: wings.scale.clone()
    })

    // Engine
    const engineGeometry = new THREE.CylinderGeometry(0.15, 0.2, 0.5, 8)
    const engineMaterial = new THREE.MeshStandardMaterial({
      color: 0x2c2c2c,  // Dark gray
      metalness: 0.9,
      roughness: 0.2,
      emissive: 0xff6348,
      emissiveIntensity: 0.3
    })
    const engine = new THREE.Mesh(engineGeometry, engineMaterial)
    engine.rotation.x = Math.PI / 2
    engine.position.set(0, 0, -0.9)
    engine.name = 'Engine'
    group.add(engine)
    parts.push({
      mesh: engine,
      name: 'Engine',
      originalPosition: engine.position.clone(),
      originalRotation: engine.rotation.clone(),
      originalScale: engine.scale.clone()
    })

    const boundingBox = new THREE.Box3().setFromObject(group)

    console.log(`Spacecraft model generated: ${parts.length} parts`)

    return { object: group, parts, boundingBox }
  }
}
