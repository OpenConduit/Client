import { useEffect } from 'react';
import { hookRegistry, OnStreamChunkHook } from './hookRegistry';

/**
 * Register an onStreamChunk hook that fires on every streamed token.
 *
 * @example
 * useOnStreamChunk('token-counter', (chunk) => incrementCount(chunk.delta.length));
 */
export function useOnStreamChunk(
  name: string,
  fn: OnStreamChunkHook,
  deps: React.DependencyList = [],
) {
  useEffect(() => {
    hookRegistry.registerOnStreamChunk(name, fn);
    return () => hookRegistry.unregisterOnStreamChunk(name);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name, ...deps]);
}
