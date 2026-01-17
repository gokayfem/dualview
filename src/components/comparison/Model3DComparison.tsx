import { useRef, Suspense, useEffect, useMemo, useState, useCallback } from 'react'
import { Canvas, useThree, useFrame } from '@react-three/fiber'
import { OrbitControls, useGLTF, Environment, ContactShadows, Grid } from '@react-three/drei'
import { useTimelineStore } from '../../stores/timelineStore'
import { useMediaStore } from '../../stores/mediaStore'
import { usePlaybackStore } from '../../stores/playbackStore'
import { useDropZone } from '../../hooks/useDropZone'
import { cn } from '../../lib/utils'
import { Box, Camera, Loader2, RotateCw } from 'lucide-react'
import * as THREE from 'three'
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js'

// Shared camera state for synchronization between viewers
const sharedCameraState = {
  position: new THREE.Vector3(3, 1.5, 3),
  target: new THREE.Vector3(0, 0.5, 0),
  needsSync: false,
}

// Turntable animation state - shared globally for sync
const turntableState = {
  isRecording: false,
  rotation: 0,
}

// Model component that renders a GLB/GLTF model positioned on the ground
function Model({ url, turntableRotation = 0 }: { url: string; turntableRotation?: number }) {
  const { scene } = useGLTF(url)
  const rotationGroupRef = useRef<THREE.Group>(null)

  // Clone scene and calculate positioning to place model on ground
  const { clonedScene, centerOffset, yOffset, scale } = useMemo(() => {
    // Use SkeletonUtils.clone for proper skinned mesh cloning (characters with bones)
    let cloned: THREE.Object3D
    try {
      cloned = SkeletonUtils.clone(scene)
    } catch {
      // Fallback to regular clone if SkeletonUtils fails
      cloned = scene.clone(true)
    }

    // Calculate bounding box of the cloned scene
    const box = new THREE.Box3().setFromObject(cloned)
    const size = box.getSize(new THREE.Vector3())
    const center = box.getCenter(new THREE.Vector3())

    // Scale to reasonable size (max dimension = 2 units)
    const maxDim = Math.max(size.x, size.y, size.z)
    const targetScale = maxDim > 0 ? 2 / maxDim : 1

    // Calculate offsets
    const yOff = -box.min.y * targetScale // Place bottom at y=0
    const centerOff = new THREE.Vector3(-center.x, 0, -center.z) // Center horizontally

    return {
      clonedScene: cloned,
      centerOffset: centerOff,
      yOffset: yOff,
      scale: targetScale
    }
  }, [scene])

  // Apply turntable rotation via useFrame for smooth animation
  useFrame(() => {
    if (rotationGroupRef.current) {
      rotationGroupRef.current.rotation.y = turntableRotation
    }
  })

  return (
    // Outer group for turntable rotation (rotates around world origin)
    <group ref={rotationGroupRef}>
      {/* Inner group for positioning and scaling */}
      <group position={[centerOffset.x * scale, yOffset, centerOffset.z * scale]} scale={scale}>
        <primitive object={clonedScene} />
      </group>
    </group>
  )
}

// Loading placeholder while model loads
function LoadingPlaceholder() {
  const meshRef = useRef<THREE.Mesh>(null)

  useFrame((_, delta) => {
    if (meshRef.current) {
      meshRef.current.rotation.y += delta * 0.5
    }
  })

  return (
    <mesh ref={meshRef} position={[0, 0.5, 0]}>
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial color="#555" wireframe />
    </mesh>
  )
}

// Camera sync component for the primary (left) viewer
function CameraSyncPrimary() {
  const { camera } = useThree()
  const controlsRef = useRef<any>(null)

  useFrame(() => {
    if (controlsRef.current && !turntableState.isRecording) {
      sharedCameraState.position.copy(camera.position)
      sharedCameraState.target.copy(controlsRef.current.target)
      sharedCameraState.needsSync = true
    }
  })

  return (
    <OrbitControls
      ref={controlsRef}
      makeDefault
      enableDamping
      dampingFactor={0.1}
      target={[0, 0.5, 0]}
      minPolarAngle={0.1}
      maxPolarAngle={Math.PI / 2 + 0.3}
      enabled={!turntableState.isRecording}
    />
  )
}

// Camera sync component for the secondary (right) viewer
function CameraSyncSecondary() {
  const { camera } = useThree()
  const controlsRef = useRef<any>(null)

  useFrame(() => {
    if (sharedCameraState.needsSync && controlsRef.current) {
      camera.position.lerp(sharedCameraState.position, 0.3)
      controlsRef.current.target.lerp(sharedCameraState.target, 0.3)
      controlsRef.current.update()
    }
  })

  return (
    <OrbitControls
      ref={controlsRef}
      makeDefault
      enableDamping
      dampingFactor={0.1}
      target={[0, 0.5, 0]}
      enabled={false}
    />
  )
}

// Scene setup with flat grey background and lime grid
function SceneSetup({ children, isPrimary }: { children: React.ReactNode; isPrimary: boolean }) {
  return (
    <>
      {/* Flat dark grey background */}
      <color attach="background" args={['#4a4a4a']} />

      {/* Ambient and directional lights */}
      <ambientLight intensity={0.09} />
      <directionalLight
        position={[5, 8, 5]}
        intensity={0.15}
        castShadow
        shadow-mapSize={[1024, 1024]}
      />
      <directionalLight position={[-5, 5, -5]} intensity={0.08} />

      {/* Model */}
      {children}

      {/* Contact shadows for grounded look */}
      <ContactShadows
        position={[0, 0, 0]}
        opacity={0.4}
        scale={10}
        blur={2}
        far={4}
        color="#000000"
      />

      {/* Lime grid on the floor */}
      <Grid
        position={[0, 0.001, 0]}
        args={[20, 20]}
        cellSize={0.5}
        cellThickness={0.6}
        cellColor="#b8cc24"
        sectionSize={2}
        sectionThickness={1.2}
        sectionColor="#cddc39"
        fadeDistance={20}
        fadeStrength={1}
        infiniteGrid
      />

      {/* Environment for lighting */}
      <Environment preset="studio" environmentIntensity={0.3} />

      {/* Camera controls */}
      {isPrimary ? <CameraSyncPrimary /> : <CameraSyncSecondary />}
    </>
  )
}

// Empty state component
function EmptyState({ side }: { side: 'A' | 'B' }) {
  return (
    <div className="w-full h-full flex flex-col items-center justify-center text-text-muted bg-gradient-to-b from-[#2a2a3a] to-[#1a1a2a] gap-3">
      <Box className="w-10 h-10 opacity-50" />
      <span className="text-sm font-medium">Drop 3D Model {side}</span>
      <span className="text-xs opacity-60">.glb or .gltf</span>
    </div>
  )
}

// Export panel component
interface ExportPanelProps {
  canvasRef: React.RefObject<HTMLCanvasElement | null>
  modelUrl: string | null
  side: 'A' | 'B'
}

function ExportPanel({ canvasRef, modelUrl, side }: ExportPanelProps) {
  const [isCapturing, setIsCapturing] = useState(false)

  const captureScreenshot = useCallback(async () => {
    if (!canvasRef.current) return
    setIsCapturing(true)

    try {
      const canvas = canvasRef.current
      const dataUrl = canvas.toDataURL('image/png', 1.0)

      const link = document.createElement('a')
      link.download = `3d-model-${side.toLowerCase()}-${Date.now()}.png`
      link.href = dataUrl
      link.click()
    } catch (err) {
      console.error('Screenshot failed:', err)
    } finally {
      setIsCapturing(false)
    }
  }, [canvasRef, side])

  if (!modelUrl) return null

  return (
    <div className="absolute top-3 right-3 z-10">
      <button
        onClick={captureScreenshot}
        disabled={isCapturing}
        className="p-2 bg-black/60 backdrop-blur-sm hover:bg-black/80 text-white rounded transition-colors disabled:opacity-50"
        title="Screenshot"
      >
        {isCapturing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
      </button>
    </div>
  )
}

// Canvas wrapper with ref for export
interface ModelCanvasProps {
  modelUrl: string
  isPrimary: boolean
  turntableRotation: number
  onCanvasReady: (canvas: HTMLCanvasElement) => void
}

function ModelCanvas({ modelUrl, isPrimary, turntableRotation, onCanvasReady }: ModelCanvasProps) {
  return (
    <Canvas
      camera={{ position: [3, 1.5, 3], fov: 45 }}
      gl={{ antialias: true, preserveDrawingBuffer: true }}
      shadows
      onCreated={({ gl }) => onCanvasReady(gl.domElement)}
    >
      <SceneSetup isPrimary={isPrimary}>
        <Suspense fallback={<LoadingPlaceholder />}>
          <Model url={modelUrl} turntableRotation={turntableRotation} />
        </Suspense>
      </SceneSetup>
    </Canvas>
  )
}

export function Model3DComparison() {
  const { tracks, duration } = useTimelineStore()
  const { getFile } = useMediaStore()
  const { currentTime, isPlaying } = usePlaybackStore()
  const dropZoneA = useDropZone({ trackType: 'a' })
  const dropZoneB = useDropZone({ trackType: 'b' })

  const canvasARef = useRef<HTMLCanvasElement | null>(null)
  const canvasBRef = useRef<HTMLCanvasElement | null>(null)
  const [rotationsPerCycle, setRotationsPerCycle] = useState(1)

  // Get model clips from timeline
  const trackA = tracks.find(t => t.type === 'a')
  const trackB = tracks.find(t => t.type === 'b')
  const clipA = trackA?.clips[0]
  const clipB = trackB?.clips[0]

  const mediaA = clipA ? getFile(clipA.mediaId) : null
  const mediaB = clipB ? getFile(clipB.mediaId) : null

  // Only show models in 3D comparison
  const modelA = mediaA?.type === 'model' ? mediaA : null
  const modelB = mediaB?.type === 'model' ? mediaB : null

  // Calculate rotation based on timeline position
  // Full rotation (2π radians) per cycle, configurable number of cycles per timeline duration
  const timelineDuration = duration || 5 // Default 5 seconds if no duration
  const progress = currentTime / timelineDuration
  const turntableRotation = progress * Math.PI * 2 * rotationsPerCycle

  // Reset state when component mounts
  useEffect(() => {
    sharedCameraState.position.set(3, 1.5, 3)
    sharedCameraState.target.set(0, 0.5, 0)
    sharedCameraState.needsSync = false
    turntableState.isRecording = false
    turntableState.rotation = 0
  }, [])

  return (
    <div className="w-full h-full flex">
      {/* Hidden file inputs for click-to-upload */}
      <input
        ref={dropZoneA.fileInputRef}
        type="file"
        accept=".glb,.gltf"
        className="hidden"
        onChange={dropZoneA.handleFileInputChange}
      />
      <input
        ref={dropZoneB.fileInputRef}
        type="file"
        accept=".glb,.gltf"
        className="hidden"
        onChange={dropZoneB.handleFileInputChange}
      />

      {/* Model A Viewer */}
      <div
        className={cn(
          'flex-1 relative border-r border-border cursor-pointer',
          dropZoneA.isDragOver && 'ring-2 ring-inset ring-accent'
        )}
        {...dropZoneA.dropZoneProps}
        onClick={() => !modelA && dropZoneA.openFileDialog()}
      >
        {modelA ? (
          <ModelCanvas
            modelUrl={modelA.url}
            isPrimary={true}
            turntableRotation={turntableRotation}
            onCanvasReady={(canvas) => { canvasARef.current = canvas }}
          />
        ) : (
          <EmptyState side="A" />
        )}

        {/* Label */}
        <div className="absolute bottom-3 left-3 px-2 py-0.5 bg-accent/80 text-white text-xs font-semibold pointer-events-none">
          A
        </div>

        {/* Model info */}
        {modelA && (
          <div className="absolute top-3 left-3 px-2 py-1 bg-black/60 backdrop-blur-sm text-text-primary text-xs pointer-events-none rounded">
            {modelA.name}
          </div>
        )}

        {/* Screenshot button for A */}
        <ExportPanel canvasRef={canvasARef} modelUrl={modelA?.url || null} side="A" />
      </div>

      {/* Model B Viewer */}
      <div
        className={cn(
          'flex-1 relative cursor-pointer',
          dropZoneB.isDragOver && 'ring-2 ring-inset ring-secondary'
        )}
        {...dropZoneB.dropZoneProps}
        onClick={() => !modelB && dropZoneB.openFileDialog()}
      >
        {modelB ? (
          <ModelCanvas
            modelUrl={modelB.url}
            isPrimary={false}
            turntableRotation={turntableRotation}
            onCanvasReady={(canvas) => { canvasBRef.current = canvas }}
          />
        ) : (
          <EmptyState side="B" />
        )}

        {/* Label */}
        <div className="absolute bottom-3 right-3 px-2 py-0.5 bg-secondary/80 text-black text-xs font-semibold pointer-events-none">
          B
        </div>

        {/* Model info */}
        {modelB && (
          <div className="absolute top-3 left-3 px-2 py-1 bg-black/60 backdrop-blur-sm text-text-primary text-xs pointer-events-none rounded">
            {modelB.name}
          </div>
        )}

        {/* Screenshot button for B */}
        <ExportPanel canvasRef={canvasBRef} modelUrl={modelB?.url || null} side="B" />
      </div>

      {/* Instructions overlay when both slots are empty */}
      {!modelA && !modelB && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="bg-black/70 backdrop-blur-sm px-5 py-4 text-center rounded-lg">
            <p className="text-text-primary text-sm font-medium">3D Model Comparison</p>
            <p className="text-text-muted text-xs mt-1">
              Drop or click to load GLB/GLTF models
            </p>
            <p className="text-text-muted text-xs mt-1 opacity-60">
              Use timeline to control rotation
            </p>
          </div>
        </div>
      )}

      {/* Rotation settings - shown when models are loaded */}
      {(modelA || modelB) && (
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-10">
          <div className="flex items-center gap-2 bg-black/70 backdrop-blur-sm px-3 py-2 rounded-lg">
            <RotateCw className="w-4 h-4 text-text-muted" />
            <span className="text-xs text-text-muted">Rotations:</span>
            <div className="flex gap-1">
              {[1, 2, 3, 4].map((num) => (
                <button
                  key={num}
                  onClick={() => setRotationsPerCycle(num)}
                  className={cn(
                    'w-6 h-6 text-xs rounded transition-colors',
                    rotationsPerCycle === num
                      ? 'bg-accent text-white'
                      : 'bg-white/10 text-text-muted hover:bg-white/20'
                  )}
                >
                  {num}
                </button>
              ))}
            </div>
            <span className="text-xs text-text-muted ml-2">
              {isPlaying ? 'Playing' : `${Math.round((progress % 1) * 360)}°`}
            </span>
          </div>
        </div>
      )}
    </div>
  )
}

// Export turntable state and canvas refs for use in ExportDialog
export { turntableState }
export type { ModelCanvasProps }
