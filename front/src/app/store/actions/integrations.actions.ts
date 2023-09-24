export namespace Integrations {
  /**
   * @description Sets the integrations
   */
  export class Set {
    static readonly type = '[Integrations] Set';
    constructor(public integrations: Integration[]) {}
  }

  /**
   * @description Makes a request to get all the integrations
   */
  export class Get {
    static readonly type = '[Integrations] Get All';
  }

  export class AddOne {
    static readonly type = '[Integrations] Add one';
    constructor(public integration: Integration) {}
  }

  export class RemoveOne {
    static readonly type = '[Integrations] Remove one';
    constructor(public integrationId: number) {}
  }

  export class PatchOne {
    static readonly type = '[Integrations] Patch one';
    constructor(public integration: Integration) {}
  }
}
