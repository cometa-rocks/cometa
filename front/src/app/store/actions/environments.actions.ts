/**
 * Environments Actions for environments.state.ts
 */
export namespace Environments {
  /**
   * @description Sets the environments array
   * @param {Environment[]} environments Array of environments
   */
  export class SetEnvironments {
    static readonly type = '[Environments] Set Environments';
    constructor(public environments: Environment[]) {}
  }

  /**
   * @description Makes a request to get all the environments for the current user
   */
  export class GetEnvironments {
    static readonly type = '[Environments] Get All';
  }

  /**
   * @description Updates an environment given ID
   * @param {Environment} environment Environment object
   */
  export class UpdateEnvironment {
    static readonly type = '[Environments] Update one';
    constructor(public environment: Environment) {}
  }

  /**
   * @description Adds an environment
   * @param {Environment} env Environment object
   */
  export class AddEnvironment {
    static readonly type = '[Environments] Add Environment';
    constructor(public env: Environment) {}
  }

  /**
   * @description Removes an environment
   * @param {number} environment_id EnvironmentID
   */
  export class RemoveEnvironment {
    static readonly type = '[Environments] Remove Environment';
    constructor(public environment_id: number) {}
  }
}
