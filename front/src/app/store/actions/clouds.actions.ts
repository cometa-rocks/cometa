/**
 * Cloud Actions for clouds.state.ts
 */
export namespace Clouds {
  /**
   * @description Set Clouds array
   * @param {Cloud[]} clouds Array of clouds
   */
  export class SetClouds {
    static readonly type = '[Clouds] Set';
    constructor(public clouds: Cloud[]) {}
  }
}
