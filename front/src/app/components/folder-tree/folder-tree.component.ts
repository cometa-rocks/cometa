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
import { Configuration } from '@store/actions/config.actions';
import { Features } from '@store/actions/features.actions';
import { FeaturesState } from '@store/features.state';
import { Router } from '@angular/router';
import { LogService } from '@services/log.service';
import { SharedActionsService } from '@services/shared-actions.service';
import { FolderItemTreeComponent } from '../folder-item-tree/folder-item-tree.component';
import { NgFor, AsyncPipe } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TranslateModule } from '@ngx-translate/core';

@Component({
  selector: 'cometa-folder-tree',
  templateUrl: './folder-tree.component.html',
  styleUrls: ['./folder-tree.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [MatTooltipModule, MatIconModule, NgFor, FolderItemTreeComponent, AsyncPipe, TranslateModule],
})
export class FolderTreeComponent implements OnInit {
  constructor(
    private _store: Store,
    private _router: Router,
    private log: LogService,
    private _sharedActions: SharedActionsService
  ) {}

  @Select(CustomSelectors.GetConfigProperty('co_active_list'))
  activeList$: Observable<string>; // Checks if the recent list is active
  @Select(FeaturesState.GetCurrentRouteNew) route$: Observable<
    ReturnType<typeof FeaturesState.GetCurrentRouteNew>
  >; // Get the current route

  // Global variables
  folders$: Observable<Folder[]>;

  ngOnInit() {
    this.log.msg('1', 'Inicializing component...', 'folder-tree');

    this.folders$ = this._store.select<Folder[]>(
      CustomSelectors.GetDepartmentFolders()
    ); // Get the list of departments available to the user
    this.activeList$.subscribe(value =>
      localStorage.setItem('co_active_list', value)
    ); // Initialize the recentList_active variable in the local storage

    // as soon as the view is loaded, get the route of the folder that was selected last
    // the last selected folder route is saved in localstorage from store/actions/features.state.ts in a function called setFolderRoute
    // it is actualized ever time any folder is clicked
    const last_selected_folder = JSON.parse(
      localStorage.getItem('co_last_selected_folder_route')
    );
    this.log.msg(
      '1',
      'Getting last selected folder route...',
      'folder-tree',
      last_selected_folder
    );

    // dispach recieved route to features state manager to adapt the path of the currently selected folder accordingly
    // this will load the same folder path that user was working on, before reloading browser window
    this.log.msg(
      '1',
      'Dispatching last selected folder route to store...',
      'folder-tree',
      last_selected_folder
    );
    this._store.dispatch(new Features.SetFolderRoute(last_selected_folder));
  }

  /**
   * Dispatch functions
   */

  // Hides the sidenav
  hideSidenav() {
    this.log.msg('1', 'Hiding sidenav...', 'folder-tree');
    return this._store.dispatch(
      new Configuration.SetProperty('openedSidenav', false)
    );
  }

  /**
   * Toggle the recent list variable in the store
   * @returns new Configuration of co_active_list
   * @author dph000
   * @date 08-10-21
   * @lastModification 08-10-21
   */
  toggleListType(listType: string) {
    this.log.msg('1', 'Navigating to root(home)...', 'folder-tree');
    this._sharedActions.set_url_folder_params('');

    this._router.navigate(['/new']);
    return this._store.dispatch(
      new Configuration.SetProperty('co_active_list', listType, true)
    );
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
