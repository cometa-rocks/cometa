/**
 * Paginated List Actions for paginated-list.state.ts
 */
export namespace PaginatedList {
  /**
   * @description Set items for a given list id and page
   */
  export class SetList {
    static readonly type = '[PaginatedList] Set';
    constructor(
      public readonly listId: string,
      public readonly page: number,
      public readonly items: any[]
    ) {}
  }
}
