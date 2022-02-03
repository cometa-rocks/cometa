/**
 * folder-item-tree.component.ts
 *
 * Contains the code to control the behaviour of each folde tree item
 *
 * @author: dph000
 */
import { ChangeDetectionStrategy, Component, Input, OnDestroy, OnInit } from '@angular/core';
import { Dispatch } from '@ngxs-labs/dispatch-decorator';
import { Select, Store } from '@ngxs/store';
import { CustomSelectors } from '@others/custom-selectors';
import { Configuration } from '@store/actions/config.actions';
import { Features } from '@store/actions/features.actions';
import { FeaturesState } from '@store/features.state';
import { BehaviorSubject, Observable } from 'rxjs';

@Component({
  selector: 'cometa-folder-item-tree',
  templateUrl: './folder-item-tree.component.html',
  styleUrls: ['./folder-item-tree.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class FolderItemTreeComponent implements OnInit {

  // stores state for each folder in hierarchy
  folderState = {};


  constructor(private _store: Store) {
    // get folder hierarchy state from localstorage, in case it is users first time entering, default department´s state will be set to false(closed)
    // if localstorage is empty, then set default values
    this.folderState =
      JSON.parse(localStorage.getItem('co_folderState'))
      ||
      { Default: { open: false }, comment: "This object stores the state of whole folder hierarchy in localstorage" };
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
    // small change as per #3358,  check the modification reasoning in redmine
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
  @Dispatch() hideSidenav = () => new Configuration.SetProperty('openedSidenav', false);

  // Hides / shows the sidenav
  @Dispatch() toggleSidenav() {
    const opened = this._store.selectSnapshot<boolean>(CustomSelectors.GetConfigProperty('openedSidenav'));
    return new Configuration.SetProperty('openedSidenav', !opened);
  }

  /**
   * Hides the search if active
   * @returns new Configuration of openedSearch
   * @author dph000
   * @date 06-10-21
   * @lastModification 06-10-21
   */
  @Dispatch() toggleSearch() {
    return new Configuration.SetProperty('openedSearch', false);
  }

  /**
   * Toggle the recent list variable in the store
   * @returns new Configuration of co_active_list
   * @author dph000
   * @date 04-10-21
   * @lastModification 05-10-21
   */
  @Dispatch()
  toggleList() {
    this.toggleSidenav();
    return new Configuration.SetProperty('co_active_list', 'list', true);
  }

  /**
   * General functions
   */

  /**
   * Function to toggle expanded state of current folder
   * @param canClose If the current folder should close
   */

  // strange behavior, ask why limit toggling, depending on recieved argument <<<<<<<<<<<<<<<<<<<<<<<<----------------------------------------
  /*toggleRow(canClose: boolean) {
    let status = !this.expanded$.getValue();
     if (!canClose && !status) {
      return
    }
    this.expanded$.next(status);
  }*/

  // reverses the folder state from true to false or viceversa
  toggleRow() {
    let status = !this.expanded$.getValue();
    this.expanded$.next(status);
  }


  // this is a folder toggle event, but it is applied only on arrow icon
  // why applied 2 different click events? one on arrow icon and another on folder name?
  // when we can apply single click event on a single parent container which contains both of these elements?
  /*
  toggleExpandFromArrow(event: MouseEvent) {
    //console.clicked folder
    console.log(this.folder);
    console.log(this.expanded$.getValue());
    this.toggleRow(true);
    event.stopPropagation();
  }*/

  // Changes the current folder and closes every active expandable
  toggleExpand() {
    // prevents folder closing when folder name or icon is clicked, careful, bad practice !!!
    // this.toggleRow(false); 

    // console currently clicked folder and its state(opened/closed)
    // behaves as desired
    // console.log(this.folder);
    // console.log(this.expanded$.getValue());

    // modify existing folder state, or add new instance of folder with its state
    this.folderState[this.folder.name] = {
      open: this.expanded$.getValue()
    };

    // refresh localstorage, so the next time this component view is rendered, it behaves correctly
    localStorage.setItem('co_folderState', JSON.stringify(this.folderState));

    // toggle folder (open/close)
    this.toggleRow();

    if (this.folder.folder_id == 0) {
      this._store.dispatch(new Features.ReturnToFolderRoute(0));
    } else {
      this.toggleList();
      this.hideSidenav();
      this._store.dispatch(new Features.SetFolderRoute(this.parent));
    }
    this.toggleSearch();
  }

}
