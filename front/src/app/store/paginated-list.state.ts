import { State, Action, StateContext, Selector } from '@ngxs/store';
import { Injectable } from '@angular/core';
import { PaginatedList } from './actions/paginated-list.actions';
import produce from 'immer';

/**
 * @description Contains the state of all network paginated lists
 * @author Alex Barba
 */
@State<IPaginatedListsState>({
  name: 'paginated_lists',
  defaults: {
      // @ts-ignore
      comment: 'This state manages the list items for each pagination used for the NetworkPaginatedList component'
  }
})
@Injectable()
export class PaginatedListsState {

    @Action(PaginatedList.SetList)
    set({ setState }: StateContext<IPaginationsState>, { listId, page, items }: PaginatedList.SetList) {
        setState(
            produce((ctx: IPaginatedListsState) => {
                // Make sure listId exists
                if (!ctx.hasOwnProperty(listId)) {
                    ctx[listId] = {};
                }
                // Make sure page exists
                if (!ctx[listId].hasOwnProperty(page)) {
                    ctx[listId][page] = [];
                }
                // Assign items to list and page
                ctx[listId][page] = items;
            })
        )
    }

    @Selector()
    static GetPagedItems(lists: IPaginatedListsState) {
        return (listId: string) => lists[listId];
    }

    @Selector()
    static GetItems(lists: IPaginatedList) {
        return (listId: string) => {
            let items = [];
            for (const page in lists[listId]) {
                if (lists[listId][page]) {
                    items = [ ...items, ...lists[listId][page] ];
                }
            }
            return items;
        }
    }


    @Selector()
    static GetFeatureResults(lists: IPaginatedList) {
        return (listId: string) => {
            let feature_results = [];

            for(const item in lists[listId]) {
                let feature_runs = lists[listId][item];
                if(!feature_runs) return []

                feature_runs.forEach(feature_run => {
                    feature_run.feature_results?.forEach(feature_result => {
                        feature_results.push(feature_result);
                    });
                }); 
            }
            return feature_results;
        }
    }
}
