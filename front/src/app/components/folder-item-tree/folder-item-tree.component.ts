/**
 * folder-item-tree.component.ts
 *
 * Contains the code to control the behaviour of each folde tree item
 *
 * @author: dph000
 */
import { ChangeDetectionStrategy, Component, Input, OnInit } from '@angular/core';
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

  constructor(
    private _store: Store
  ) { }

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

    // small change as per #3358, check the modification reasoning in redmine
    if (this.folder.folder_id === 0) {
      this.expanded$ = new BehaviorSubject<boolean>(false);
    } else {
      this.expanded$ = new BehaviorSubject<boolean>(true);
    }
    const isFolderInRoute = this._store.selectSnapshot(CustomSelectors.IsFolderInRoute(this.folder));
    if (isFolderInRoute) {
      this.expanded$.next(true);
    }
    console.log(this.folder);
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
  toggleRow(canClose: boolean) {
    let status = !this.expanded$.getValue();
    if (!canClose && !status) {
      return
    }
    this.expanded$.next(status);
  }

  toggleExpandFromArrow(event: MouseEvent) {
    this.toggleRow(true);
    event.stopPropagation();
  }

  // Changes the current folder and closes every active expandable
  toggleExpand() {
    this.toggleRow(false); // Don't close when clicking into folder icon or text
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
