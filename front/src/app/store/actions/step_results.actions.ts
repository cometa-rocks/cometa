/**
 * Run Actions for runs.state.ts
 */
export namespace StepResults {
  /**
   * @description Makes a request to get steps for a feature
   * @param {number} featureId Feature ID
   * @param {number} resultId Feature Result ID
   */
  export class GetStepResults {
    static readonly type = '[Step Results] Get';
    constructor(
      public readonly featureId: number,
      public readonly resultId: number,
      public readonly page: number
    ) {}
  }
}
