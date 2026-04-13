import { useState, useCallback, useRef } from 'react';

const MAX_HISTORY = 30;

export function useUndoRedo<T>(initial: T) {
  const [past, setPast] = useState<T[]>([]);
  const [present, setPresent] = useState<T>(initial);
  const [future, setFuture] = useState<T[]>([]);
  // Track if we're mid undo/redo to avoid pushing to history
  const skipRef = useRef(false);

  /** Push a new state (clears redo stack) */
  const push = useCallback((newState: T) => {
    if (skipRef.current) return;
    setPast(p => [...p.slice(-(MAX_HISTORY - 1)), present]);
    setPresent(newState);
    setFuture([]);
  }, [present]);

  /** Force-set present without pushing to history (e.g. external sync) */
  const reset = useCallback((newState: T) => {
    skipRef.current = true;
    setPresent(newState);
    setPast([]);
    setFuture([]);
    skipRef.current = false;
  }, []);

  const undo = useCallback((): T | null => {
    if (past.length === 0) return null;
    const previous = past[past.length - 1];
    skipRef.current = true;
    setPast(p => p.slice(0, -1));
    setFuture(f => [present, ...f]);
    setPresent(previous);
    skipRef.current = false;
    return previous;
  }, [past, present]);

  const redo = useCallback((): T | null => {
    if (future.length === 0) return null;
    const next = future[0];
    skipRef.current = true;
    setFuture(f => f.slice(1));
    setPast(p => [...p, present]);
    setPresent(next);
    skipRef.current = false;
    return next;
  }, [future, present]);

  return {
    present,
    push,
    reset,
    undo,
    redo,
    canUndo: past.length > 0,
    canRedo: future.length > 0,
    historySize: past.length,
  };
}
