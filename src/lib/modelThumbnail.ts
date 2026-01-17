import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'

export async function generateModelThumbnail(url: string): Promise<string> {
  return new Promise((resolve) => {
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      preserveDrawingBuffer: true,
    })
    renderer.setSize(160, 90)
    renderer.setClearColor(0x1a1a1a)

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(45, 160 / 90, 0.1, 1000)

    // Add lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6)
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8)
    directionalLight.position.set(5, 5, 5)
    scene.add(ambientLight, directionalLight)

    const loader = new GLTFLoader()
    loader.load(
      url,
      (gltf) => {
        const model = gltf.scene

        // Center and scale model to fit
        const box = new THREE.Box3().setFromObject(model)
        const center = box.getCenter(new THREE.Vector3())
        const size = box.getSize(new THREE.Vector3())
        const maxDim = Math.max(size.x, size.y, size.z)

        model.position.sub(center)
        if (maxDim > 0) {
          model.scale.multiplyScalar(2 / maxDim)
        }
        scene.add(model)

        // Position camera
        camera.position.set(2, 1.5, 2)
        camera.lookAt(0, 0, 0)

        // Render single frame
        renderer.render(scene, camera)
        const dataUrl = renderer.domElement.toDataURL('image/jpeg', 0.7)

        // Cleanup
        renderer.dispose()
        scene.traverse((obj) => {
          if (obj instanceof THREE.Mesh) {
            obj.geometry?.dispose()
            if (Array.isArray(obj.material)) {
              obj.material.forEach((m) => m.dispose())
            } else {
              obj.material?.dispose()
            }
          }
        })

        resolve(dataUrl)
      },
      undefined,
      () => {
        // On error, return empty string
        renderer.dispose()
        resolve('')
      }
    )
  })
}
