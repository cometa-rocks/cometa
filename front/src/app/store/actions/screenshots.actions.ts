/**
 * Screenshot Actions for screenshots.state.ts
 */
export namespace Screenshots {
  /**
   * @description Set screenshots for a given Step Result
   * @param {number} stepResultId Step Result ID
   * @param {string[]} screenshots Array of 3 screenshots
   */
  export class SetScreenshots {
    static readonly type = '[Screenshots] Set';
    constructor(
      public readonly stepResultId: number,
      public readonly screenshots: string[]
    ) {}
  }

  /**
   * @description Makes a request to get screenshots for a step result
   * @param {number} stepResultId Step Result ID
   */
  export class GetScreenshots {
    static readonly type = '[Screenshots] Get';
    constructor(public readonly stepResultId: number) {}
  }

  /**
   * @description Removes a screenshot from a step result
   * @param {number} stepResultId Step Result ID
   * @param {number} index Screenshot Index
   */
  export class RemoveScreenshot {
    static readonly type = '[Screenshots] Remove';
    constructor(
      public readonly stepResultId: number,
      public readonly index: number
    ) {}
  }
}
