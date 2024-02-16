/**
 * Step Definition Actions for step-definitions.state.ts
 */
export namespace StepDefinitions {
  /**
   * @description Set steps for a feature
   * @param {number} featureId Feature ID
   * @param {FeatureStep[]} steps Array of FeatureStep
   */
  export class SetStepsForFeature {
    static readonly type = '[Steps Definition] Set';
    constructor(
      public readonly featureId: number,
      public readonly steps: FeatureStep[]
    ) {}
  }

  /**
   * @description Makes a request to get steps for specific feature
   * @param {number} featureId Feature ID
   */
  export class GetStepsForFeature {
    static readonly type = '[Steps Definition] Get';
    constructor(public readonly featureId: number) {}
  }

  /**
   * @description Clear steps for new feature
   */
  export class ClearNewFeature {
    static readonly type = '[Steps Definition] Clear new';
  }
}
