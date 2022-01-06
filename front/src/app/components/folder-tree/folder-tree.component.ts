/**
 * folder-tree.component.ts
 *
 * Contains the code to control the behaviour of the folder tree in the new landing
 *
 * @author: dph000
 */
import { ChangeDetectionStrategy, Component, OnInit } from '@angular/core';
import { Select, Store } from '@ngxs/store';
import { Observable } from 'rxjs';
import { CustomSelectors } from '@others/custom-selectors';
import { Dispatch } from '@ngxs-labs/dispatch-decorator';
import { Configuration } from '@store/actions/config.actions';
import { Features } from '@store/actions/features.actions';
import { FeaturesState } from '@store/features.state';

@Component({
  selector: 'cometa-folder-tree',
  templateUrl: './folder-tree.component.html',
  styleUrls: ['./folder-tree.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class FolderTreeComponent implements OnInit {

  constructor(private _store: Store) { }

  @Select(CustomSelectors.GetConfigProperty('co_active_list')) activeList$: Observable<string>; // Checks if the recent list is active
  @Select(FeaturesState.GetCurrentRouteNew) route$: Observable<ReturnType<typeof FeaturesState.GetCurrentRouteNew>>; // Get the current route

  /**
   * Global variables
   */
  folders$: Observable<Folder[]>;

  // NgOnInit
  ngOnInit() {
    this.folders$ = this._store.select<Folder[]>(CustomSelectors.GetDepartmentFolders()); // Get the list of departments available to the user
    this.activeList$.subscribe(value => localStorage.setItem('co_active_list', value)); // Initialize the recentList_active variable in the local storage
  }

  /**
   * Dispatch functions
   */

  // Hides the sidenav
  @Dispatch() hideSidenav = () => new Configuration.SetProperty('openedSidenav', false);

  /**
   * Toggle the recent list variable in the store
   * @returns new Configuration of co_active_list
   * @author dph000
   * @date 08-10-21
   * @lastModification 08-10-21
   */
  @Dispatch()
  toggleListType(listType: string) {
    return new Configuration.SetProperty('co_active_list', listType, true);
  }

  /**
   * Global functions
   */

  /**
   * Toggle the list type
   * @returns new Configuration of co_active_list
   * @author dph000
   * @date 04-10-21
   * @lastModification 11-10-21
   */
  toggleList(listType: string) {
    this.hideSidenav(); // Hide the sidenav on mobile
    this.toggleListType(listType); // Toggles the list type
    this._store.dispatch(new Features.ReturnToFolderRoute(0)); // Remove the current route
  }
}