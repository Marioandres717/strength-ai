import { createClientOnlyFn } from "@tanstack/react-start"
import * as client from "./workoutRepository.client"
import type { WorkoutStore } from "./workoutRepository.client"

export const idbRequest = createClientOnlyFn(<T>(request: IDBRequest<T>) =>
  client.idbRequest(request)
)
export const repositoryGet = createClientOnlyFn(
  <T>(store: WorkoutStore, key: IDBValidKey) =>
    client.repositoryGet<T>(store, key)
)
export const repositoryAll = createClientOnlyFn(<T>(store: WorkoutStore) =>
  client.repositoryAll<T>(store)
)
export const repositoryPut = createClientOnlyFn(
  <T>(store: WorkoutStore, key: IDBValidKey, value: T) =>
    client.repositoryPut(store, key, value)
)
export const repositoryTransaction = createClientOnlyFn(
  <T>(
    stores: WorkoutStore[],
    work: (tx: IDBTransaction) => Promise<T> | T,
    mode?: IDBTransactionMode
  ) => client.repositoryTransaction(stores, work, mode)
)
