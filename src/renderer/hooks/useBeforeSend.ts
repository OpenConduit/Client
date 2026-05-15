import { useEffect } from 'react';
import { hookRegistry, BeforeSendHook } from './hookRegistry';

/**
 * Register a beforeSend middleware hook.
 * The hook receives the ChatRequest and can return a modified version.
 *
 * @example
 * useBeforeSend('my-hook', (req) => ({ ...req, systemPrompt: 'Always respond in French.' }));
 */
export function useBeforeSend(
  name: string,
  fn: BeforeSendHook,
  deps: React.DependencyList = [],
) {
  useEffect(() => {
    hookRegistry.registerBeforeSend(name, fn);
    return () => hookRegistry.unregisterBeforeSend(name);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name, ...deps]);
}
