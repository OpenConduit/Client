import { useEffect } from 'react';
import { hookRegistry, OnResponseHook } from './hookRegistry';

/**
 * Register an onResponse hook that fires when an assistant message is finalized.
 *
 * @example
 * useOnResponse('logger', (msg) => console.log('AI responded:', msg.content));
 */
export function useOnResponse(
  name: string,
  fn: OnResponseHook,
  deps: React.DependencyList = [],
) {
  useEffect(() => {
    hookRegistry.registerOnResponse(name, fn);
    return () => hookRegistry.unregisterOnResponse(name);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name, ...deps]);
}
