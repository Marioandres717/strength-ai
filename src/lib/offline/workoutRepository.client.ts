const STORES = [
  "definitions",
  "revisions",
  "context",
  "runs",
  "sets",
  "feedback",
  "outbox",
  "generationRequests",
] as const
export type WorkoutStore = (typeof STORES)[number]
let connection: Promise<IDBDatabase> | undefined

function openRepository(): Promise<IDBDatabase> {
  connection ??= new Promise((resolve, reject) => {
    const request = indexedDB.open("strength-ai-workouts", 1)
    request.onupgradeneeded = () => {
      for (const name of STORES)
        if (!request.result.objectStoreNames.contains(name))
          request.result.createObjectStore(name)
    }
    request.onsuccess = () => {
      request.result.onversionchange = () => {
        request.result.close()
        connection = undefined
      }
      resolve(request.result)
    }
    request.onerror = () => {
      connection = undefined
      reject(request.error ?? new Error("Device storage is unavailable."))
    }
    request.onblocked = () =>
      reject(
        new Error("Close other Strength AI tabs to update device storage.")
      )
  })
  return connection
}
export function idbRequest<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () =>
      reject(request.error ?? new Error("Device storage request failed."))
  })
}

/** All related durable facts and commands commit or roll back together. */
export async function repositoryTransaction<T>(
  stores: WorkoutStore[],
  work: (transaction: IDBTransaction) => Promise<T> | T,
  mode: IDBTransactionMode = "readwrite"
): Promise<T> {
  const db = await openRepository()
  const tx = db.transaction(stores, mode)
  const done = new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve()
    tx.onabort = () =>
      reject(tx.error ?? new Error("Device storage write failed."))
    tx.onerror = () =>
      reject(tx.error ?? new Error("Device storage transaction failed."))
  })
  try {
    const result = await work(tx)
    await done
    return result
  } catch (error) {
    try {
      tx.abort()
    } catch {
      /* Already finished. */
    }
    await done.catch(() => undefined)
    throw error
  }
}
export async function repositoryGet<T>(
  store: WorkoutStore,
  key: IDBValidKey
): Promise<T | undefined> {
  return repositoryTransaction(
    [store],
    (tx) =>
      idbRequest(tx.objectStore(store).get(key)) as Promise<T | undefined>,
    "readonly"
  )
}
export async function repositoryAll<T>(store: WorkoutStore): Promise<T[]> {
  return repositoryTransaction(
    [store],
    (tx) => idbRequest(tx.objectStore(store).getAll()) as Promise<T[]>,
    "readonly"
  )
}
export async function repositoryPut<T>(
  store: WorkoutStore,
  key: IDBValidKey,
  value: T
): Promise<void> {
  await repositoryTransaction([store], (tx) => {
    tx.objectStore(store).put(value, key)
  })
}
