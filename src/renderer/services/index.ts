import type { AppService } from './appService';

/**
 * The Electron implementation of AppService — delegates directly to
 * `window.api` which is set up by the context bridge in preload.ts.
 *
 * To create a web/enterprise adapter, implement AppService against your
 * backend API and export it as `service` from this file (or swap out the
 * import in the consuming package).
 */
export const service: AppService = window.api as AppService;
