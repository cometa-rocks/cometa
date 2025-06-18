import {
  Component,
  ChangeDetectionStrategy,
  OnInit,
  Inject,
  Input,
} from '@angular/core';
import { MatLegacyDialog as MatDialog } from '@angular/material/legacy-dialog';
import { LogOutputComponent } from '@dialogs/log-output/log-output.component';
import { ApiService } from '@services/api.service';
import { LiveStepsComponent } from '@dialogs/live-steps/live-steps.component';
import { MatLegacySnackBar as MatSnackBar } from '@angular/material/legacy-snack-bar';
import { Store } from '@ngxs/store';
import { ResultsState } from '@store/results.state';
import {
  debounceTime,
  distinctUntilChanged,
  filter,
  map,
  shareReplay,
  switchMap,
  tap,
  catchError,
} from 'rxjs/operators';
import { ActivatedRoute } from '@angular/router';
import { FeaturesState } from '@store/features.state';
import { SafeUrl, DomSanitizer } from '@angular/platform-browser';
import { API_BASE } from 'app/tokens';
import { Observable, fromEvent } from 'rxjs';
import { CustomSelectors } from '@others/custom-selectors';
import { KEY_CODES } from '@others/enums';
import { WebSockets } from '@store/actions/results.actions';
import { SharedActionsService } from '@services/shared-actions.service';
import { PaginatedListsState } from '@store/paginated-list.state';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { ErrorDialog } from '@dialogs/error/error.dialog';
import { MatLegacyTooltipModule } from '@angular/material/legacy-tooltip';
import { NgIf, AsyncPipe } from '@angular/common';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

@UntilDestroy()
@Component({
  selector: 'cometa-feature-actions',
  templateUrl: './feature-actions.component.html',
  styleUrls: ['./feature-actions.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [NgIf, MatLegacyTooltipModule, AsyncPipe, MatProgressSpinnerModule],
})
export class FeatureActionsComponent implements OnInit {
  notificationEnabled$: Observable<boolean>;
  canEditFeature$: Observable<boolean>;
  pdfLink$: Observable<SafeUrl>;
  csvLink$: Observable<SafeUrl>;
  isRunning: boolean = false;
  isRunButtonDisabled: boolean = false;

  featureId$: Observable<number>;
  featureResultId$: Observable<number>;
  running$: Observable<boolean>;

  @Input() latestFeatureResultId: number = 0;

  constructor(
    private _dialog: MatDialog,
    private _api: ApiService,
    private _store: Store,
    private _snack: MatSnackBar,
    private _ac: ActivatedRoute,
    private _sanitizer: DomSanitizer,
    public _sharedActions: SharedActionsService,
    @Inject(API_BASE) private _api_base: string
  ) {
    // Get feature id from URL params
    this.featureId$ = this._ac.paramMap.pipe(
      map(params => +params.get('feature')),
      distinctUntilChanged(),
      shareReplay({ bufferSize: 1, refCount: true })
    );
    // Get feature result id from URL params
    this.featureResultId$ = this._ac.paramMap.pipe(
      map(params => +params.get('feature_result_id')),
      distinctUntilChanged(),
      shareReplay({ bufferSize: 1, refCount: true })
    );
  }

  getFeatureId = () => +this._ac.snapshot.paramMap.get('feature');

  ngOnInit() {
    this.feature$ = this.featureId$.pipe(
      switchMap(id => this._store.select(CustomSelectors.GetFeatureInfo(id)))
    );
    this.running$ = this.featureId$.pipe(
      switchMap(id =>
        this._store.select(CustomSelectors.GetFeatureRunningStatus(id))
      )
    );
    // Show PDF download link in Feature Actions toolbar
    this.pdfLink$ = this.featureResultId$.pipe(
      map(resultId =>
        resultId
          ? this._sanitizer.bypassSecurityTrustUrl(
              `${this._api_base}pdf/?feature_result_id=${resultId}&download=true`
            )
          : null
      )
    );
    // Show CSV download link in Feature Actions toolbar
    this.csvLink$ = this.featureId$.pipe(
      map(featureId =>
        featureId
          ? this._sanitizer.bypassSecurityTrustUrl(
              `${this._api_base}get_steps_result_csv/${featureId}/`
            )
          : null
      )
    );
    this.canEditFeature$ = this.featureId$.pipe(
      switchMap(id =>
        this._store.select(CustomSelectors.HasPermission('edit_feature', id))
      )
    );
    this.notificationEnabled$ = this.featureId$.pipe(
      switchMap(id =>
        this._store.select(CustomSelectors.GetNotificationEnabled(id))
      )
    );
    fromEvent(document, 'keydown')
      .pipe(untilDestroyed(this), distinctUntilChanged(), debounceTime(150))
      .subscribe((event: KeyboardEvent) => this.handleKeyboardEvent(event));
  }

  feature$: Observable<Feature>;

  handleKeyboardEvent(event: KeyboardEvent) {
    // Handle keyboard letters
    // - Space: Run test
    // - L: View log
    // - E: Edit test
    // - S: Schedule test
    // - N: Toggle notifications
    // Only if no dialog is opened and no modifier keys are pressed
    const isAnyDialogOpened =
      document.querySelectorAll('.mat-dialog-container').length > 0;
    const hasModifierKeys = event.ctrlKey || event.altKey || event.metaKey || event.shiftKey;
    
    if (!isAnyDialogOpened && !this._sharedActions.dialogActive && !hasModifierKeys) {
      let hotkeyFound = true;
      switch (event.keyCode) {
        case KEY_CODES.SPACE:
          const videoInView = document.querySelector("video-player");
          if(videoInView == null){
            this.runNow();
          }
          break;
        case KEY_CODES.C:
          this.downloadCSV();
          break;
        case KEY_CODES.E:
          // this._sharedActions.dialogActive = true;
          if(!this._sharedActions.dialogActiveOther){
            this._sharedActions.openEditFeature(this.getFeatureId(), 'edit');
          }
          break;
        case KEY_CODES.L:
          this._sharedActions.dialogActive = true;
          this.viewLog();
          break;
        case KEY_CODES.P:
          this.downloadPDF();
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

  downloadCSV() {
    this.csvLink$.pipe(
      // tap allows you to execute functions or actions every time a value is output to the data stream
      tap(link => {
        if (!link) {
           this._snack.open('CSV link is not available');
        }
      }),
      catchError(error => {
        this._snack.open('An error occurred while downloading CSV', 'OK');
        // Return an empty observable or array to continue the stream with no emissions
        return [];
      })
    ).subscribe(link => {
      const linkElement = document.getElementById('csvLink') as HTMLAnchorElement;
      if (linkElement) {
        linkElement.click();
      }
    });
  }

  downloadPDF() {
    this.pdfLink$.pipe(
      tap(link => {
        if (!link) {
           this._snack.open('PDF link is not available');
        }
      }),
      catchError(error => {
        this._snack.open('An error occurred while downloading PDF', 'OK');
        return [];
      })
    ).subscribe(link => {
      const linkElement = document.getElementById('pdfLink') as HTMLAnchorElement;
      if (linkElement) {
        linkElement.click();
      }
    });
  }

  viewLog() {
    // Get feature result id from URL params
    let featureResultId = +this._ac.snapshot.paramMap.get('feature_result_id');

    // Or get id from last run object
    if (featureResultId == 0) {
      featureResultId = this.latestFeatureResultId;
    }

    if (featureResultId != 0) {
      this._dialog
        .open(LogOutputComponent, {
          disableClose: true,
          panelClass: 'enter-value-panel',
          data: featureResultId,
        })
        .afterClosed()
        .subscribe(_ => (this._sharedActions.dialogActive = false));
    } else {
      this._dialog.open(ErrorDialog, {
        id: 'error',
        data: {
          error:
            'There are no logs for this feature. Please execute the feature and then review the logs. If you think this is a bug, please let us know.',
        },
      });
    }
  }

  async runNow() {
    if (this.isRunButtonDisabled) return;
    this.isRunButtonDisabled = true;
    const featureStore = this._store.selectSnapshot(
      FeaturesState.GetFeatureInfo
    )(this.getFeatureId());
    // Request backend to know if feature is running
    const isRunning = await this._api
      .isFeatureRunning(this.getFeatureId())
      .toPromise();
    if (isRunning) {
      // Notify WebSocket Server to send me last websockets of feature
      this._sharedActions.retrieveLastFeatureSockets(this.getFeatureId());
      this.openLiveSteps(featureStore.feature_id);
      this.isRunButtonDisabled = false;
    } else {
      // Check if the feature has at least 1 browser selected, if not, show a warning
      if (featureStore.browsers.length > 0) {
        this._api
          .runFeature(featureStore.feature_id, false)
          .pipe(
            filter(json => !!json.success),
            switchMap(res =>
              this._store
                .dispatch(
                  new WebSockets.FeatureTaskQueued(featureStore.feature_id)
                )
                .pipe(map(_ => res))
            )
          )
          .subscribe(
            res => {
              if (res.success) {
                this._snack.open(
                  `Feature ${featureStore.feature_name} is running...`,
                  'OK'
                );
                this.openLiveSteps(featureStore.feature_id);
              } else {
                this._snack.open('An error ocurred', 'OK');
              }
            },
            err => {
              this._snack.open('An error ocurred', 'OK');
            }
            
          );
      } else {
        this._snack.open("This feature doesn't have browsers selected.", 'OK');
      }
      this.isRunButtonDisabled = false;
    }
  }

  openLiveSteps(feature_id: number) {
    this._dialog.open(LiveStepsComponent, {
      data: feature_id,
      panelClass: 'live-steps-panel',
    }).afterClosed().subscribe(() => {
      this.isRunning = false;
    });
  }

  toggleNotification() {
    const featureStore = this._store.selectSnapshot(
      FeaturesState.GetFeatureInfo
    )(this.getFeatureId());
    const notifications = this._store.selectSnapshot(
      ResultsState.GetNotifications
    );

    return notifications.includes(featureStore.feature_id)
      ? this._store.dispatch(
          new WebSockets.RemoveNotificationID(featureStore.feature_id)
        )
      : this._store.dispatch(
          new WebSockets.AddNotificationID(featureStore.feature_id)
        );
  }
}
