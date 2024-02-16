/**
 * Config Actions for config.state.ts
 * Initial config data comes from config.json
 */
export namespace Configuration {
  /**
   * @description Sets the configuration
   * @param {Config} config Configuration object
   */
  export class SetConfig {
    static readonly type = '[Config] Set Config';
    constructor(public config: Config) {}
  }

  /**
   * @description Makes a request to get the configuration info
   */
  export class GetConfig {
    static readonly type = '[Config] Get Config';
  }

  /**
   * @description Modify a property of Config
   * @param {string} key Property to modify, use dot notation for nested properties
   * @param {any} value Value to modify on property
   */
  export class SetProperty {
    static readonly type = '[Config] Set Property';
    constructor(
      public key: string,
      public value: any,
      public save: boolean = false
    ) {}
  }

  /**
   * @description Changes true / false of percentMode property
   */
  export class ChangePercentMode {
    static readonly type = '[Config] Change PercentMode';
  }

  /**
   * @description Changes toggle options
   * @param {string} key Collapsible key to toggle
   * @param {boolean} value Set to true or false
   */
  export class ToggleCollapsible {
    static readonly type = '[Config] Toggle Collapsible';
    constructor(
      public key: string,
      public value: boolean
    ) {}
  }

  /**
   * @description Set pagination options
   * @param {number} index Index of current pagination
   * @param {number} size Page size of current pagination
   */
  export class SetPagination {
    static readonly type = '[Config] Set Pagination';
    constructor(
      public readonly index: number,
      public readonly size: number
    ) {}
  }
}
