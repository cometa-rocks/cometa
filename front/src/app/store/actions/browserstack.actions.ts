/**
 * Browserstack Browser Actions for browserstack.state.ts
 */
export namespace Browserstack {
  /**
   * @description Sets the browsers of Browserstack
   * @param {BrowserstackBrowser[]} browsers Array of Browserstack browsers objects
   */
  export class SetBrowserstacks {
    static readonly type = '[Browserstack] Set Browserstacks';
    constructor(public browsers: BrowserstackBrowser[]) {}
  }

  /**
   * @description Makes a request to get all the browsers from Browserstack
   */
  export class GetBrowserstack {
    static readonly type = '[Browserstack] Get All';
  }
}
