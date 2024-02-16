/**
 * Log Actions for logs.state.ts
 * This actions manages all the features logs dialog
 */
export namespace Logs {
  /**
   * @description Makes a request to get log of a feature result
   * @param {number} featureResultId Feature Result ID
   */
  export class GetLogs {
    static readonly type = '[Logs] Get';
    constructor(public readonly featureResultId: number) {}
  }
}
