/**
 * Local Browser Actions for browsers.state.ts
 */
export namespace Browsers {
  /**
   * @description Sets the browsers
   * @param {BrowserResultObject[]} browsers Array of local browser objects
   */
  export class SetBrowsers {
    static readonly type = '[Browsers] Set Browsers';
    constructor(public browsers: BrowserResultObject[]) {}
  }

  /**
   * @description Makes a request to get all the local browsers
   */
  export class GetBrowsers {
    static readonly type = '[Browsers] Get All';
  }

  /**
   * @description Update one local browser
   * @param {BrowserResultObject} browser Browser to update
   */
  export class UpdateBrowser {
    static readonly type = '[Browsers] Update one';
    constructor(public browser: BrowserResultObject) {}
  }

  /**
   * @description Remove browser
   * @param {number} browser_id BrowserID
   */
  export class RemoveBrowser {
    static readonly type = '[Browsers] Remove';
    constructor(public browser_id: number) {}
  }
}
