/**
 * IndexedDB wrapper for project persistence (PERSIST-001)
 * 
 * Provides a simple API for storing and retrieving projects and media blobs
 * in the browser's IndexedDB storage.
 */

const DB_NAME = 'dualview-projects'
const DB_VERSION = 1

// DB Schema types (for documentation)
// projects: ProjectRecord
// media: MediaBlobRecord

export interface ProjectRecord {
  id: string
  name: string
  description: string
  tags: string[]
  createdAt: number // timestamp
  updatedAt: number // timestamp
  thumbnail: string | null // base64 screenshot
  
  // Serialized state
  timelineState: string // JSON
  projectSettings: string // JSON
  mediaManifest: MediaManifestEntry[] // List of media IDs and metadata
  
  // KEYFRAME-001: Keyframe data (serialized as array of [clipId, ClipKeyframes] tuples)
  keyframeData?: string // JSON - array of [string, ClipKeyframes][]
}

export interface MediaManifestEntry {
  id: string
  name: string
  type: string
  duration?: number
  width?: number
  height?: number
  promptText?: string
  waveformPeaks?: number[]
  // MEDIA-012: Status tracking (stored files are always 'ready')
  status?: 'pending' | 'processing' | 'ready' | 'error'
}

export interface MediaBlobRecord {
  id: string // format: projectId:mediaId
  projectId: string
  mediaId: string
  blob: Blob
  mimeType: string
}

let db: IDBDatabase | null = null

/**
 * Initialize the IndexedDB database
 */
export async function initDB(): Promise<IDBDatabase> {
  if (db) return db

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onerror = () => {
      console.error('Failed to open IndexedDB:', request.error)
      reject(request.error)
    }

    request.onsuccess = () => {
      db = request.result
      resolve(db)
    }

    request.onupgradeneeded = (event) => {
      const database = (event.target as IDBOpenDBRequest).result

      // Create projects store
      if (!database.objectStoreNames.contains('projects')) {
        const projectStore = database.createObjectStore('projects', { keyPath: 'id' })
        projectStore.createIndex('updatedAt', 'updatedAt', { unique: false })
        projectStore.createIndex('name', 'name', { unique: false })
      }

      // Create media blobs store
      if (!database.objectStoreNames.contains('media')) {
        const mediaStore = database.createObjectStore('media', { keyPath: 'id' })
        mediaStore.createIndex('projectId', 'projectId', { unique: false })
      }
    }
  })
}

/**
 * Get the database instance, initializing if needed
 */
async function getDB(): Promise<IDBDatabase> {
  if (!db) {
    await initDB()
  }
  return db!
}

/**
 * Save a project record to IndexedDB
 */
export async function saveProject(project: ProjectRecord): Promise<void> {
  const database = await getDB()

  return new Promise((resolve, reject) => {
    const transaction = database.transaction(['projects'], 'readwrite')
    const store = transaction.objectStore('projects')
    const request = store.put(project)

    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve()
  })
}

/**
 * Get a project by ID
 */
export async function getProject(id: string): Promise<ProjectRecord | null> {
  const database = await getDB()

  return new Promise((resolve, reject) => {
    const transaction = database.transaction(['projects'], 'readonly')
    const store = transaction.objectStore('projects')
    const request = store.get(id)

    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve(request.result || null)
  })
}

/**
 * Get all projects, sorted by updatedAt descending
 */
export async function getAllProjects(): Promise<ProjectRecord[]> {
  const database = await getDB()

  return new Promise((resolve, reject) => {
    const transaction = database.transaction(['projects'], 'readonly')
    const store = transaction.objectStore('projects')
    const index = store.index('updatedAt')
    const request = index.openCursor(null, 'prev') // descending order

    const projects: ProjectRecord[] = []

    request.onerror = () => reject(request.error)
    request.onsuccess = () => {
      const cursor = request.result
      if (cursor) {
        projects.push(cursor.value)
        cursor.continue()
      } else {
        resolve(projects)
      }
    }
  })
}

/**
 * Delete a project and its associated media
 */
export async function deleteProject(id: string): Promise<void> {
  const database = await getDB()

  return new Promise((resolve, reject) => {
    const transaction = database.transaction(['projects', 'media'], 'readwrite')

    // Delete project
    const projectStore = transaction.objectStore('projects')
    projectStore.delete(id)

    // Delete associated media blobs
    const mediaStore = transaction.objectStore('media')
    const mediaIndex = mediaStore.index('projectId')
    const mediaRequest = mediaIndex.openCursor(IDBKeyRange.only(id))

    mediaRequest.onsuccess = () => {
      const cursor = mediaRequest.result
      if (cursor) {
        cursor.delete()
        cursor.continue()
      }
    }

    transaction.oncomplete = () => resolve()
    transaction.onerror = () => reject(transaction.error)
  })
}

/**
 * Save a media blob for a project
 */
export async function saveMediaBlob(
  projectId: string,
  mediaId: string,
  blob: Blob
): Promise<void> {
  const database = await getDB()

  return new Promise((resolve, reject) => {
    const transaction = database.transaction(['media'], 'readwrite')
    const store = transaction.objectStore('media')
    const record: MediaBlobRecord = {
      id: `${projectId}:${mediaId}`,
      projectId,
      mediaId,
      blob,
      mimeType: blob.type,
    }
    const request = store.put(record)

    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve()
  })
}

/**
 * Get a media blob by project and media ID
 */
export async function getMediaBlob(
  projectId: string,
  mediaId: string
): Promise<Blob | null> {
  const database = await getDB()

  return new Promise((resolve, reject) => {
    const transaction = database.transaction(['media'], 'readonly')
    const store = transaction.objectStore('media')
    const request = store.get(`${projectId}:${mediaId}`)

    request.onerror = () => reject(request.error)
    request.onsuccess = () => {
      const record = request.result as MediaBlobRecord | undefined
      resolve(record?.blob || null)
    }
  })
}

/**
 * Get all media blobs for a project
 */
export async function getProjectMediaBlobs(
  projectId: string
): Promise<Map<string, Blob>> {
  const database = await getDB()

  return new Promise((resolve, reject) => {
    const transaction = database.transaction(['media'], 'readonly')
    const store = transaction.objectStore('media')
    const index = store.index('projectId')
    const request = index.openCursor(IDBKeyRange.only(projectId))

    const blobs = new Map<string, Blob>()

    request.onerror = () => reject(request.error)
    request.onsuccess = () => {
      const cursor = request.result
      if (cursor) {
        const record = cursor.value as MediaBlobRecord
        blobs.set(record.mediaId, record.blob)
        cursor.continue()
      } else {
        resolve(blobs)
      }
    }
  })
}

/**
 * Delete media blobs for a project
 */
export async function deleteProjectMedia(projectId: string): Promise<void> {
  const database = await getDB()

  return new Promise((resolve, reject) => {
    const transaction = database.transaction(['media'], 'readwrite')
    const store = transaction.objectStore('media')
    const index = store.index('projectId')
    const request = index.openCursor(IDBKeyRange.only(projectId))

    request.onerror = () => reject(request.error)
    request.onsuccess = () => {
      const cursor = request.result
      if (cursor) {
        cursor.delete()
        cursor.continue()
      } else {
        resolve()
      }
    }
  })
}

/**
 * Estimate storage usage for the database
 */
export async function estimateStorageUsage(): Promise<{
  used: number
  quota: number
  percentUsed: number
}> {
  if ('storage' in navigator && 'estimate' in navigator.storage) {
    const estimate = await navigator.storage.estimate()
    const used = estimate.usage || 0
    const quota = estimate.quota || 0
    return {
      used,
      quota,
      percentUsed: quota > 0 ? (used / quota) * 100 : 0,
    }
  }
  return { used: 0, quota: 0, percentUsed: 0 }
}

/**
 * Check if IndexedDB is available
 */
export function isIndexedDBAvailable(): boolean {
  try {
    return typeof indexedDB !== 'undefined' && indexedDB !== null
  } catch {
    return false
  }
}

/**
 * Clear all data from the database
 */
export async function clearAllData(): Promise<void> {
  const database = await getDB()

  return new Promise((resolve, reject) => {
    const transaction = database.transaction(['projects', 'media'], 'readwrite')

    transaction.objectStore('projects').clear()
    transaction.objectStore('media').clear()

    transaction.oncomplete = () => resolve()
    transaction.onerror = () => reject(transaction.error)
  })
}
