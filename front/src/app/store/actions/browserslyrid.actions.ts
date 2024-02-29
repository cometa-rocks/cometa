/**
 * Lyrid Browser Actions for lyrid.state.ts
 */
export namespace Lyrid {
  /**
   * @description Sets the browsers of Browserstack
   * @param {BrowserstackBrowser[]} browsers Array of Lyrid browsers objects
   */
  export class SetLyridBrowsers {
    static readonly type = '[Lyrid] Set Browserstacks';
    constructor(public browsers: BrowserstackBrowser[]) {}
  }

  /**
   * @description Makes a request to get all the browsers from Browserstack
   */
  export class GetLyridBrowsers {
    static readonly type = '[Lyrid] Get All';
  }
}
