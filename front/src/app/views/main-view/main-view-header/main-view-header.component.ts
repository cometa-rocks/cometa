import { CdkDragDrop, moveItemInArray, CdkDropList, CdkDrag, CdkDragHandle } from '@angular/cdk/drag-drop';
import { ChangeDetectionStrategy, Component, Host, OnInit, Optional } from '@angular/core';
import { MatLegacyCheckboxChange as MatCheckboxChange, MatLegacyCheckboxModule } from '@angular/material/legacy-checkbox';
import { MatLegacySnackBar as MatSnackBar } from '@angular/material/legacy-snack-bar';
import { ActivatedRoute } from '@angular/router';
import { Select, Store } from '@ngxs/store';
import { CustomSelectors } from '@others/custom-selectors';
import { Configuration } from '@store/actions/config.actions';
import { deepClone } from 'ngx-amvara-toolbox';
import { Observable, of, Subject } from 'rxjs';
import { LoadingSnack } from '@components/snacks/loading/loading.snack';
import { ApiService } from '@services/api.service';
import { debounceTime, map, switchMap } from 'rxjs/operators';
import { User } from '@store/actions/user.actions';
import { NetworkPaginatedListComponent } from '@components/network-paginated-list/network-paginated-list.component';
import { TranslateModule } from '@ngx-translate/core';
import { MatDividerModule } from '@angular/material/divider';
import { MatLegacyTooltipModule } from '@angular/material/legacy-tooltip';
import { StopPropagationDirective } from '../../../directives/stop-propagation.directive';
import { MatLegacyMenuModule } from '@angular/material/legacy-menu';
import { NgClass, NgFor, AsyncPipe } from '@angular/common';
import { LetDirective } from '../../../directives/ng-let.directive';

@Component({
    selector: 'cometa-main-view-header',
    templateUrl: './main-view-header.component.html',
    styleUrls: ['./main-view-header.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
    standalone: true,
    imports: [LetDirective, NgClass, MatLegacyMenuModule, StopPropagationDirective, MatLegacyCheckboxModule, CdkDropList, NgFor, CdkDrag, CdkDragHandle, MatLegacyTooltipModule, MatDividerModule, TranslateModule, AsyncPipe]
})
export class MainViewHeaderComponent implements OnInit {

  /** Holds all the current headers of the results table */
  @Select(CustomSelectors.RetrieveResultHeaders(true, true)) allHeaders: Observable<ResultHeader[]>;

  @Select(CustomSelectors.GetConfigProperty('percentMode')) percentMode$: Observable<boolean>;

  /** Variable holding archived option of Config */
  @Select(CustomSelectors.GetConfigProperty('internal.showArchived')) archived$: Observable<boolean>;

  @Select(CustomSelectors.GetConfigProperty('deleteTemplateWithResults')) deleteTemplateWithResults$: Observable<boolean>;

  saveHeadersDebounce = new Subject<ResultHeader[]>();

  constructor(
    private _store: Store,
    private _snack: MatSnackBar,
    private _route: ActivatedRoute,
    private _api: ApiService,
    @Optional() @Host() private _paginatedList: NetworkPaginatedListComponent
  ) { }

  ngOnInit() {
    this.saveHeadersDebounce.pipe(
      debounceTime(500)
    ).subscribe(headers => {
      this._store.dispatch( new User.SetSetting({ result_headers: headers }))
    })
  }

  /**
   * Executed every time the user reorders table headers
   * @param {CdkDragDrop<ResultHeader[]>} event
   */
  headerChanged(event: CdkDragDrop<ResultHeader[]>) {
    // Get current headers
    const currentHeaders = deepClone(this._store.selectSnapshot(CustomSelectors.RetrieveResultHeaders(true)));
    // Perform index move
    moveItemInArray(currentHeaders, event.previousIndex, event.currentIndex);
    // Save into user settings, in backend and locally
    this.saveHeadersDebounce.next(currentHeaders);
  }

  /**
   * Executed every time the user checks/unchecks table headers
   * @param {MatCheckboxChange} event
   */
  handleHeaderChange(event: MatCheckboxChange, index: number) {
    // Get current headers
    const currentHeaders = deepClone(this._store.selectSnapshot(CustomSelectors.RetrieveResultHeaders(true)));
    // Perform index move
    currentHeaders[index].enable = event.checked;
    // Save into user settings, in backend and locally
    this.saveHeadersDebounce.next(currentHeaders);
  }

  getUniqueHeader(index, item: ResultHeader) {
    return `${item.id}_${index}`;
  }

  handleDeleteTemplateWithResults({ checked }: MatCheckboxChange) {
    return this._store.dispatch(new Configuration.SetProperty('deleteTemplateWithResults', checked));
  }

  changeSort(prop: string) {
    // FIX ME
    /* this.reverse = prop === this.sortBy ? !this.reverse : false;
    this.sortBy = prop;
    this.tests$.getValue().sort((a, b) => {
      if (!isNaN(a[prop])) {
        return a[prop] - b[prop];
      } else {
        return a[prop] > b[prop] ? 1 : -1;
      }
    }); */
    // if (this.reverse) this.tests$.getValue().reverse();
  }

  /**
   * Clears runs depending on the type of clearing passed
   * @param clearing ClearRunsType
   * @returns void
   */
  clearRuns(clearing: ClearRunsType) {
    // Open Loading Snack
    const loadingRef = this._snack.openFromComponent(LoadingSnack, {
      data: 'Clearing history...',
      duration: 60000
    });
    const featureId = +this._route.snapshot.params.feature;
    const deleteTemplateWithResults = this._store.selectSnapshot<boolean>(CustomSelectors.GetConfigProperty('deleteTemplateWithResults'));
    this._api.removeMultipleFeatureRuns(featureId, clearing, deleteTemplateWithResults).pipe(
      switchMap(res => {
        if (this._paginatedList) {
          return this._paginatedList.reloadCurrentPage().pipe(
            map(_ => res)
          );
        } else {
          return of(res);
        }
      })
    ).subscribe(_ => {
      // Close loading snack
      loadingRef.dismiss();
      // Show completed snack
      this._snack.open('History cleared', 'OK', {
        duration: 5000
      });
    })
  }

  sortBy = 'result_date';
  reverse = false;

  /**
   * Enables or disables archived runs from checkbox
   * @param change MatCheckboxChange
   */
  handleArchived = (change: MatCheckboxChange) => this._store.dispatch(new Configuration.SetProperty('internal.showArchived', change.checked));

}
