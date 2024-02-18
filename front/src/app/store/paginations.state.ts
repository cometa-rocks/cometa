import { State, Action, StateContext } from '@ngxs/store';
import { Injectable } from '@angular/core';
import produce from 'immer';
import { Paginations } from './actions/paginations.actions';

/**
 * @description Contains the state of all paginations
 * @author Alex Barba
 */
@State<IPaginationsState>({
  name: 'paginations',
  defaults: {
    // @ts-ignore
    comment: 'Same as paginated-list state but without network paginated lists',
  },
})
@Injectable()
export class PaginationsState {
  @Action(Paginations.SetPagination)
  set(
    { setState }: StateContext<IPaginationsState>,
    { paginationId, pagination }: Paginations.SetPagination
  ) {
    setState(
      produce((ctx: IPaginationsState) => {
        // Make sure pagination id object exists
        if (!ctx.hasOwnProperty(paginationId)) {
          ctx[paginationId] = {
            id: paginationId,
          };
        }
        // Merge pagination changes
        ctx[paginationId] = {
          ...ctx[paginationId],
          ...pagination,
          id: paginationId,
        };
        localStorage.setItem(
          `pagination.size.${paginationId}`,
          pagination.pageSize.toString()
        );
      })
    );
  }

  @Action(Paginations.ResetPagination)
  reset(
    { setState }: StateContext<IPaginationsState>,
    { paginationId }: Paginations.ResetPagination
  ) {
    setState(
      produce((ctx: IPaginationsState) => {
        if (!Array.isArray(paginationId)) {
          paginationId = [paginationId];
        }
        for (const id of paginationId) {
          if (ctx.hasOwnProperty(id)) {
            ctx[id].pageIndex = 0;
          }
        }
      })
    );
  }
}
