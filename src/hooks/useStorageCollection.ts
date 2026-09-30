import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Subscribes a component to one or more local collections.
 *
 * Fourteen views each declared their own `useState(getX())` plus an identical
 * `useEffect` subscribing to the `trigon_db_updated` event and re-reading every
 * collection in the handler. This replaces that with one call, and re-reads
 * only when one of the watched keys actually changed.
 *
 * Returns `[value, refresh]`. `refresh` performs exactly the read the event
 * handler performs, so a view that used to call `setX(StorageService.getX())`
 * imperatively after a save keeps doing the same thing, now through the hook.
 */
export function useStorageCollection<T>(
  read: () => T,
  storageKeys: string[]
): [T, () => void] {
  const [value, setValue] = useState<T>(read);

  // Keep the latest reader without making the effect depend on a new function
  // identity on every render.
  const readRef = useRef(read);
  readRef.current = read;

  const keysRef = useRef(storageKeys);
  keysRef.current = storageKeys;

  const refresh = useCallback(() => {
    setValue(readRef.current());
  }, []);

  useEffect(() => {
    const handleUpdate = (event: Event) => {
      const detail = (event as CustomEvent<{ key?: string }>).detail;
      // A payload-less dispatch means "everything changed".
      if (!detail?.key || keysRef.current.includes(detail.key)) {
        refresh();
      }
    };
    window.addEventListener('trigon_db_updated', handleUpdate);
    return () => window.removeEventListener('trigon_db_updated', handleUpdate);
  }, [refresh]);

  return [value, refresh];
}

type CollectionReaders = Record<string, () => unknown>;
type ReadCollections<R extends CollectionReaders> = { [K in keyof R]: ReturnType<R[K]> };

/**
 * Convenience wrapper for the common "several collections at once" case.
 *
 * `readers` are functions, not values: the collections are read at the moment
 * the event fires, which is what the hand-written handlers did. Re-reads on
 * every `trigon_db_updated`, i.e. it has no key filter, so a view using this
 * can never miss an update to one of the collections it renders.
 */
export function useStorageCollections<R extends CollectionReaders>(
  readers: R
): [ReadCollections<R>, () => void] {
  // Keep the latest readers without making the effect depend on a new function
  // identity on every render.
  const readersRef = useRef(readers);
  readersRef.current = readers;

  const readAll = useCallback(() => {
    const current = readersRef.current;
    const result = {} as ReadCollections<R>;
    for (const name of Object.keys(current) as Array<keyof R>) {
      result[name] = current[name]() as ReadCollections<R>[typeof name];
    }
    return result;
  }, []);

  const [value, setValue] = useState<ReadCollections<R>>(readAll);

  const refresh = useCallback(() => {
    setValue(readAll());
  }, [readAll]);

  useEffect(() => {
    const handleUpdate = () => refresh();
    window.addEventListener('trigon_db_updated', handleUpdate);
    return () => window.removeEventListener('trigon_db_updated', handleUpdate);
  }, [refresh]);

  return [value, refresh];
}
