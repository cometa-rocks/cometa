/**
 * folder-item-tree.component.ts
 *
 * Contains the code to control the behaviour of each folde tree item
 *
 * @author: dph000
 */
import { ChangeDetectionStrategy, Component, Input, OnInit } from '@angular/core';
import { Select, Store } from '@ngxs/store';
import { SharedActionsService } from '@services/shared-actions.service';
import { CustomSelectors } from '@others/custom-selectors';
import { Configuration } from '@store/actions/config.actions';
import { Features } from '@store/actions/features.actions';
import { FeaturesState } from '@store/features.state';
import { BehaviorSubject, Observable } from 'rxjs';
import { LogService } from '@services/log.service';

@Component({
  selector: 'cometa-folder-item-tree',
  templateUrl: './folder-item-tree.component.html',
  styleUrls: ['./folder-item-tree.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class FolderItemTreeComponent implements OnInit {

  // stores state for each folder in hierarchy
  folderState = {};

  constructor(private _store: Store, public _sharedActions: SharedActionsService, private log: LogService) {
    this.getOrSetDefaultFolderState();
    this.log.msg("1","Getting folder tree state...","folder-item-tree", this.folderState);
  }

  @Input() folder: Folder;
  @Input() level: number;
  @Input() parent: Folder[] = [];
  @Input() department: boolean; // The department boolean is used to know wheter the sent object is a department or not
  @Select(FeaturesState.GetLastFolder) lastFolder$: Observable<ReturnType<typeof FeaturesState.GetLastFolder>>; // Get the last folder
  @Select(CustomSelectors.GetConfigProperty('openedSidenav')) showFolders$: Observable<boolean>; // Checks if the sidenav is opened

  /**
   * Global variables
   */
  expanded$: BehaviorSubject<boolean>;

  // NgOnInit
  ngOnInit() {
    if (this.folder.folder_id === 0) {
      this.expanded$ = new BehaviorSubject<boolean>(true);
    } else {
      this.expanded$ = new BehaviorSubject<boolean>(false);
    }
    const isFolderInRoute = this._store.selectSnapshot(CustomSelectors.IsFolderInRoute(this.folder));
    if (isFolderInRoute) {
      this.expanded$.next(true);
    }
  }

  /**
   * Dispatch functions
   */

  // Hides the sidenav
  hideSidenav() {
    this.log.msg("1","Expanding/Closing folder...","folder-item-tree");
    return this._store.dispatch(new Configuration.SetProperty('openedSidenav', false));
  }

  // Hides / shows the sidenav
  toggleSidenav() {
    const opened = this._store.selectSnapshot<boolean>(CustomSelectors.GetConfigProperty('openedSidenav'));
    return this._store.dispatch(new Configuration.SetProperty('openedSidenav', !opened));
  }

  /**
   * Hides the search if active
   * @returns new Configuration of openedSearch
   * @author dph000
   * @date 06-10-21
   * @lastModification 06-10-21
   */
  toggleSearch() {
    this.log.msg("1","Toggling folder state...","folder-item-tree");
    return this._store.dispatch(new Configuration.SetProperty('openedSearch', false));
  }

  /**
   * Toggle the recent list variable in the store
   * @returns new Configuration of co_active_list
   * @author dph000
   * @date 04-10-21
   * @lastModification 05-10-21
   */
  toggleList() {
    this.toggleSidenav();
    return this._store.dispatch(new Configuration.SetProperty('co_active_list', 'list', true));
  }

  /**
   * General functions
   */

  // reverses the folder state from true to false or viceversa
  toggleRow() {
    let status = !this.expanded$.getValue();
    this.expanded$.next(status);
  }

  // toggles clicked department/folder
  toggleExpand() {
    // update state incase it has been changed.
    this.getOrSetDefaultFolderState();

    // toggle folder (open/close)
    this.toggleRow();

    // modify existing folder state, or add new instance of folder with its state
    this.folderState[this.folder.name] = {
      open: this.expanded$.getValue()
    };

    // #3414 -------------------------------------------------start
    // change browser url, add folder ids as params
    this.log.msg("1","Setting folder id as url param...","folder-item-tree");
    this._sharedActions.set_url_folder_params(this.parent);
    // #3414 ---------------------------------------------------end

    // refresh localstorage, so the next time this component view is rendered, it behaves correctly
    this.log.msg("1","Saving folder tree state to localstorage...","folder-item-tree", this.folderState);
    localStorage.setItem('co_folderState', JSON.stringify(this.folderState));


    if (this.folder.folder_id == 0) {
      this._store.dispatch(new Features.ReturnToFolderRoute(0));
    } else {
      this.toggleList();
      this.hideSidenav();
      this._store.dispatch(new Features.SetFolderRoute(this.parent));
    }
    this.toggleSearch();
  }

  getOrSetDefaultFolderState(): void {
    // get folder hierarchy state from localstorage
    // if localstorage is empty, then just set the comment
    this.folderState =
      JSON.parse(localStorage.getItem('co_folderState')) || { comment: "This object stores the state of whole folder hierarchy in localstorage" };
  }

}
