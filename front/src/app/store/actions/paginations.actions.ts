/**
 * Pagination Actions for paginations.state.ts
 */
export namespace Paginations {
  /**
   * @description Set pagination for a given ID
   */
  export class SetPagination {
    static readonly type = '[Paginations] Set';
    constructor(
      public readonly paginationId: string,
      public readonly pagination: Partial<IPagination>
    ) {}
  }

  /**
   * @description Reset pagination for a given ID
   */
  export class ResetPagination {
    static readonly type = '[Paginations] Reset';
    constructor(public readonly paginationId: string | string[]) {}
  }
}
