/**
 * Feature Result Actions for feature_results.state.ts
 */
export namespace FeatureResults {
  /**
   * @description Set Feature Results for a given Feature Result
   * @param {number} resultId Feature Result ID
   * @param {FeatureResult} info Feature Result Info
   */
  export class SetFeatureResult {
    static readonly type = '[Feature Results] Set';
    constructor(
      public readonly resultId: number,
      public readonly info: FeatureResult
    ) {}
  }

  /**
   * @description Makes a request to get a Feature Result
   * @param {number} resultId Feature Result ID
   */
  export class GetFeatureResult {
    static readonly type = '[Feature Results] Get';
    constructor(
      public readonly resultId: number,
      public readonly useCache: boolean = false
    ) {}
  }
}
