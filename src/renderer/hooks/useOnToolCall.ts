import { useEffect } from 'react';
import { hookRegistry, OnToolCallHook } from './hookRegistry';

/**
 * Register an onToolCall hook. Return `false` to deny the tool call programmatically.
 * Only runs when requireToolApproval is enabled in settings.
 *
 * @example
 * useOnToolCall('deny-dangerous', (tc) => !dangerousTools.includes(tc.name));
 */
export function useOnToolCall(
  name: string,
  fn: OnToolCallHook,
  deps: React.DependencyList = [],
) {
  useEffect(() => {
    hookRegistry.registerOnToolCall(name, fn);
    return () => hookRegistry.unregisterOnToolCall(name);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name, ...deps]);
}
