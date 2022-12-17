import { Component, ChangeDetectionStrategy, OnInit, Inject } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { LogOutputComponent } from '@dialogs/log-output/log-output.component';
import { ApiService } from '@services/api.service';
import { LiveStepsComponent } from '@dialogs/live-steps/live-steps.component';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Store } from '@ngxs/store';
import { ResultsState } from '@store/results.state';
import { debounceTime, distinctUntilChanged, filter, map, shareReplay, switchMap } from 'rxjs/operators';
import { ActivatedRoute } from '@angular/router';
import { FeaturesState } from '@store/features.state';
import { SafeUrl, DomSanitizer } from '@angular/platform-browser';
import { API_BASE } from 'app/tokens';
import { Observable, fromEvent } from 'rxjs';
import { CustomSelectors } from '@others/custom-selectors';
import { Dispatch } from '@ngxs-labs/dispatch-decorator';
import { KEY_CODES } from '@others/enums';
import { WebSockets } from '@store/actions/results.actions';
import { SharedActionsService } from '@services/shared-actions.service';
import { PaginatedListsState } from '@store/paginated-list.state';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';

@UntilDestroy()
@Component({
  selector: 'cometa-feature-actions',
  templateUrl: './feature-actions.component.html',
  styleUrls: ['./feature-actions.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class FeatureActionsComponent implements OnInit {

  notificationEnabled$: Observable<boolean>;
  canEditFeature$: Observable<boolean>;
  pdfLink$: Observable<SafeUrl>;

  featureId$: Observable<number>;
  featureResultId$: Observable<number>;
  running$: Observable<boolean>;

  constructor(
    private _dialog: MatDialog,
    private _api: ApiService,
    private _store: Store,
    private _snack: MatSnackBar,
    private _ac: ActivatedRoute,
    private _sanitizer: DomSanitizer,
    public _sharedActions: SharedActionsService,
    @Inject(API_BASE) private _api_base: string,
  ) {
    // Get feature id from URL params
    this.featureId$ = this._ac.paramMap.pipe(
      map(params => +params.get('feature')),
      distinctUntilChanged(),
      shareReplay({ bufferSize: 1, refCount: true })
    )
    // Get feature result id from URL params
    this.featureResultId$ = this._ac.paramMap.pipe(
      map(params => +params.get('feature_result_id')),
      distinctUntilChanged(),
      shareReplay({ bufferSize: 1, refCount: true })
    )
  }

  getFeatureId = () => +this._ac.snapshot.paramMap.get('feature');

  ngOnInit() {
    this.feature$ = this.featureId$.pipe(
      switchMap(id => this._store.select(CustomSelectors.GetFeatureInfo(id)))
    )
    this.running$ = this.featureId$.pipe(
      switchMap(id => this._store.select(CustomSelectors.GetFeatureRunningStatus(id)))
    )
    // Show PDF download link in Feature Actions toolbar
    this.pdfLink$ = this.featureResultId$.pipe(
      map(resultId => resultId ? this._sanitizer.bypassSecurityTrustUrl(`${this._api_base}pdf/?feature_result_id=${resultId}&download=true`) : null)
    )
    this.canEditFeature$ = this.featureId$.pipe(
      switchMap(id => this._store.select(CustomSelectors.HasPermission('edit_feature', id)))
    )
    this.notificationEnabled$ = this.featureId$.pipe(
      switchMap(id => this._store.select(CustomSelectors.GetNotificationEnabled(id)))
    )
    fromEvent(document, 'keydown').pipe(
      untilDestroyed(this),
      distinctUntilChanged(),
      debounceTime(150)
    ).subscribe((event: KeyboardEvent) => this.handleKeyboardEvent(event));
  }

  feature$: Observable<Feature>;

  handleKeyboardEvent(event: KeyboardEvent) {
    // Handle keyboard letters
    // - Space: Run test
    // - L: View log
    // - E: Edit test
    // - S: Schedule test
    // - N: Toggle notifications
    // Only if no dialog is opened
    const isAnyDialogOpened = document.querySelectorAll('.mat-dialog-container').length > 0;
    if (!isAnyDialogOpened && !this._sharedActions.dialogActive) {
      let hotkeyFound = true;
      switch ( event.keyCode ) {
        case KEY_CODES.SPACE:
          this.runNow();
          break;
        case KEY_CODES.E:
          this._sharedActions.dialogActive = true;
          this._sharedActions.openEditFeature(this.getFeatureId(), 'edit');
          break;
        case KEY_CODES.L:
          this._sharedActions.dialogActive = true;
          this.viewLog();
          break;
        case KEY_CODES.S:
          this._sharedActions.dialogActive = true;
          this._sharedActions.editSchedule(this.getFeatureId());
          break;
        case KEY_CODES.N:
          this.toggleNotification();
          break;
        default:
          hotkeyFound = false;
      }
      if (hotkeyFound) event.preventDefault();
    }
  }

  viewLog() {
    // Get feature result id from URL params
    let featureResultId = +this._ac.snapshot.paramMap.get('feature_result_id');
    if (!featureResultId) {
      // Or get id from last run object
      const feature_results = this._store.selectSnapshot(PaginatedListsState.GetItems)('runs_' + this.getFeatureId());
      featureResultId = feature_results[0].feature_result_id;
    }
    // Open Log Dialog
    this._dialog.open(LogOutputComponent, {
      disableClose: true,
      panelClass: 'enter-value-panel',
      data: featureResultId
    }).afterClosed().subscribe(_ => this._sharedActions.dialogActive = false);
  }

  async runNow() {
    const featureStore = this._store.selectSnapshot(FeaturesState.GetFeatureInfo)(this.getFeatureId());
    // Request backend to know if feature is running
    const isRunning = await this._api.isFeatureRunning(this.getFeatureId()).toPromise();
    if (isRunning) {
      // Notify WebSocket Server to send me last websockets of feature
      this._sharedActions.retrieveLastFeatureSockets(this.getFeatureId());
      this.openLiveSteps(featureStore.feature_id);
    } else {
      // Check if the feature has at least 1 browser selected, if not, show a warning
      if (featureStore.browsers.length > 0) {
        this._api.runFeature(featureStore.feature_id, false).pipe(
          filter(json => !!json.success),
          switchMap(res => this._store.dispatch( new WebSockets.FeatureTaskQueued(featureStore.feature_id)).pipe(
            map(_ => res)
          ))
        ).subscribe(res => {
          if (res.success) {
            this._snack.open(`Feature ${featureStore.feature_name} is running...`, 'OK');
            this.openLiveSteps(featureStore.feature_id);
          } else {
            this._snack.open('An error ocurred', 'OK');
          }
        }, err => {
          this._snack.open('An error ocurred', 'OK');
        });
      } else {
        this._snack.open('This feature doesn\'t have browsers selected.', 'OK');
      }
    }
  }

  openLiveSteps(feature_id: number) {
    this._dialog.open(LiveStepsComponent, {
      data: feature_id,
      panelClass: 'live-steps-panel'
    });
  }

  @Dispatch()
  toggleNotification() {
    const featureStore = this._store.selectSnapshot(FeaturesState.GetFeatureInfo)(this.getFeatureId());
    const notifications = this._store.selectSnapshot(ResultsState.GetNotifications);
    if (notifications.includes(featureStore.feature_id)) {
      return new WebSockets.RemoveNotificationID(featureStore.feature_id);
    } else {
      return new WebSockets.AddNotificationID(featureStore.feature_id);
    }
  }

}