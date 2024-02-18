/**
 * Run Actions for runs.state.ts
 */
export namespace Runs {
  /**
   * @description Set runs for a feature
   * @param {number} featureId Feature ID
   * @param {FeatureRun[]} runs Array of runs
   */
  export class SetRuns {
    static readonly type = '[Runs] Set';
    constructor(
      public readonly featureId: number,
      public readonly runs: FeatureRun[]
    ) {}
  }

  /**
   * @description Makes a request to get runs of a feature
   * @param {number} featureId Feature ID
   */
  export class GetRuns {
    static readonly type = '[Runs] Get';
    constructor(public readonly featureId: number) {}
  }

  /**
   * @description Manually adds or updates a run within a feature result
   * @param {number} featureId Feature ID
   * @param {number} runId Run ID
   * @param {FeatureResult} featureResult Feature Result object
   */
  export class UpdateRunOffline {
    static readonly type = '[Runs] Update run offline';
    constructor(
      public readonly featureId: number,
      public readonly runId: number,
      public readonly featureResult: FeatureResult
    ) {}
  }

  /**
   * @description Updates the archived status for a given run within a feature
   * It provides a way to update archived status without repeating a request
   * @param {number} featureId Feature ID
   * @param {number} runId Run ID
   * @param {boolean} archived Saved item or not
   */
  export class UpdateRunArchivedStatus {
    static readonly type = '[Runs] Update run status';
    constructor(
      public readonly featureId: number,
      public readonly runId: number,
      public readonly archived: boolean
    ) {}
  }

  /**
   * @description Updates the archived status for a given feature result within a run and feature
   * It provides a way to update archived status without repeating a request
   * @param {number} featureId Feature ID
   * @param {number} runId Run ID
   * @param {number} featureResultId Feature Result ID
   * @param {boolean} archived Saved item or not
   */
  export class UpdateFeatureResultArchivedStatus {
    static readonly type = '[Runs] Update result status';
    constructor(
      public readonly featureId: number,
      public readonly runId: number,
      public readonly featureResultId: number,
      public readonly archived: boolean
    ) {}
  }

  /**
   * @description Makes a request to patch FeatureResult with Overriding Status
   */
  export class OverrideFeatureResultStatus {
    static readonly type = '[Runs] Override result status';
    constructor(
      public readonly featureId: number,
      public readonly runId: number,
      public readonly resultId: number,
      public readonly status: Status
    ) {}
  }

  /**
   * @description Makes a request to patch FeatureRun with Overriding Status
   */
  export class OverrideFeatureRunStatus {
    static readonly type = '[Runs] Override run status';
    constructor(
      public readonly featureId: number,
      public readonly runId: number,
      public readonly status: Status
    ) {}
  }
}
