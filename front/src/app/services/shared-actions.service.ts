import { HttpResponse } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { MatCheckboxChange } from '@angular/material/checkbox';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Router } from '@angular/router';
import { LoadingSnack } from '@components/snacks/loading/loading.snack';
import { AreYouSureData, AreYouSureDialog } from '@dialogs/are-you-sure/are-you-sure.component';
import { EditFeature } from '@dialogs/edit-feature/edit-feature.component';
import { EditIntegrationDialog, IntegrationDialogData } from '@dialogs/edit-integration/edit-integration.component';
import { EditSchedule } from '@dialogs/edit-schedule/edit-schedule.component';
import { HtmlDiffDialog } from '@dialogs/html-diff/html-diff.component';
import { LiveStepsComponent } from '@dialogs/live-steps/live-steps.component';
import { MoveItemDialog } from '@dialogs/move-feature/move-item.component';
import { SureRemoveFeatureComponent } from '@dialogs/sure-remove-feature/sure-remove-feature.component';
import { Dispatch } from '@ngxs-labs/dispatch-decorator';
import { Store, Select } from '@ngxs/store';
import { CustomSelectors } from '@others/custom-selectors';
import { Features } from '@store/actions/features.actions';
import { WebSockets } from '@store/actions/results.actions';
import { StepDefinitions } from '@store/actions/step_definitions.actions';
import { FeaturesState } from '@store/features.state';
import { LoadingActions } from '@store/loadings.state';
import { deepClone } from 'ngx-amvara-toolbox';
import { from, Observable, of, BehaviorSubject } from 'rxjs';
import { concatMap, delay, finalize, switchMap, toArray, timeout, map, filter, tap } from 'rxjs/operators';
import { ApiService } from './api.service';
import { SocketService } from './socket.service';

/**
 * This service is used to execute function which should be accessible from application and Tour definitions
 */
@Injectable()
export class SharedActionsService {

  headers$ = new BehaviorSubject<ResultHeader[]>([]);

  constructor(
    public _dialog: MatDialog,
    private _store: Store,
    private _api: ApiService,
    private _snackBar: MatSnackBar,
    private _router: Router,
    private _snack: MatSnackBar,
    private _socket: SocketService
  ) {
    this._store.select(CustomSelectors.RetrieveResultHeaders(false)).subscribe(headers => this.headers$.next(headers));
  }

  // clears localstorage corresponding to searchFilters(see it at ctrl + f11/features/filters)
  @Dispatch()
  removeSearchFilter() {
    return new Features.RemoveSearchFilter();
  }

  dialogActive = false;
  goToFeature(featureId: number) {
    const feature = this._store.selectSnapshot<Feature>(CustomSelectors.GetFeatureInfo(featureId))
    this._router.navigate([
      '/' + feature.app_name,
      feature.environment_name,
      feature.feature_id
    ]);

    // remove search filter when acceding to any features
    this.removeSearchFilter();
  }

  editSchedule(featureId: number) {
    const featureStore = this._store.selectSnapshot(FeaturesState.GetFeatureInfo)(featureId);
    this._dialog.open(EditSchedule, {
      panelClass: 'edit-schedule-panel',
      data: featureStore.feature_id
    }).afterClosed().subscribe(_ => this.dialogActive = false);
  }

  @Dispatch()
  handleSetting(featureId: number, type: string, event: MatCheckboxChange) {
    switch (type) {
      case 'need_help':
        return new Features.PatchFeature(featureId, { need_help: event.checked });
      default:
        return null;
    }
  }

  moveFeature(feature: Feature) {
    this._dialog.open(MoveItemDialog, {
      data: {
        type: 'feature',
        feature
      } as IMoveData
    });
  }

  moveFolder(folder: Folder) {
    this._dialog.open(MoveItemDialog, {
      data: {
        type: 'folder',
        folder
      } as IMoveData
    })
  }

  openLiveSteps(featureId: number) {
    return this._dialog.open(LiveStepsComponent, {
      data: featureId,
      panelClass: 'live-steps-panel'
    });
  }

  /**
   * Sends a request via WebSocket to retrieve all the occurred WS messages for a given feature
   * @param featureId Feature ID
   */
  retrieveLastFeatureSockets(featureId: number) {
    this._socket.socket && this._socket.socket.emit('featurePastMessages', { feature_id: featureId });
  }

  async run(featureId: number) {
    // Request backend to know if feature is running
    const isRunning = await this._api.isFeatureRunning(featureId).toPromise();
    const feature = this._store.selectSnapshot<Feature>(CustomSelectors.GetFeatureInfo(featureId));
    if (isRunning) {
      // Notify WebSocket Server to send me last websockets of feature
      this.retrieveLastFeatureSockets(featureId);
      this.openLiveSteps(featureId);
    } else {
      // Check if the feature has at least 1 browser selected, if not, show a warning
      if (feature.browsers.length > 0) {
        this._store.dispatch(new LoadingActions.SetLoading(featureId, true))
        this._api.runFeature(feature.feature_id, false).pipe(
          filter(json => !!json.success),
          switchMap(_ => this._store.dispatch(new WebSockets.FeatureTaskQueued(featureId))),
          finalize(() => this._store.dispatch(new LoadingActions.SetLoading(featureId, false)))
        ).subscribe(_ => {
          this._snackBar.open(`Feature ${feature.feature_name} is running...`, 'OK');
          // Make view live steps popup optional
          // this.openLiveSteps();
        }, err => {
          this._snackBar.open('An error ocurred', 'OK');
        });
      } else {
        this._snackBar.open('This feature doesn\'t have browsers selected.', 'OK');
      }
    }
  }

  /**
   * Automatically open the EditFeature dialog
   * @param featureId The feature ID to edit, provide null if new
   * @param mode Defined the behavior of EditFeature
   */
  openEditFeature(featureId: number = null, mode: 'edit' | 'clone' | 'new' = 'new') {
    if (mode === 'edit' || mode === 'clone') {
      // Edit / Clone mode
      const feature = deepClone(this._store.selectSnapshot<Feature>(CustomSelectors.GetFeatureInfo(featureId))) as Feature;
      // Get data of feature and steps
      this._api.getFeatureSteps(featureId, { loading: 'translate:tooltips.loading_feature' }).subscribe(steps => {
        // Save steps into NGXS Store
        this._store.dispatch(new StepDefinitions.SetStepsForFeature(mode === 'clone' ? 0 : featureId, steps));
        // Open Edit Feature
        this._dialog.open(EditFeature, {
          disableClose: true,
          autoFocus: false,
          panelClass: 'edit-feature-panel',
          // @ts-ignore
          data: {
            mode: mode,
            feature: {
              app: feature.app_name,
              environment: feature.environment_name,
              feature_id: feature.feature_id,
              description: feature.description
            },
            info: feature,
            steps: deepClone(steps)
          } as IEditFeature
        }).afterClosed().subscribe(_ => this.dialogActive = false);
      })
    } else {
      // New mode
      this._dialog.open(EditFeature, {
        disableClose: true,
        autoFocus: false,
        panelClass: 'edit-feature-panel',
        data: {
          mode: 'new',
          feature: {
            feature_id: 0,
            browsers: []
          }
        } as IEditFeature
      });
    }
  }

  deleteFeature(featureId: number) {
    const feature = this._store.selectSnapshot<Feature>(CustomSelectors.GetFeatureInfo(featureId))
    this._dialog.open(SureRemoveFeatureComponent, {
      data: {
        feature_name: feature.feature_name,
        feature_id: feature.feature_id
      }
    });
  }

  /**
   * Sequentally performs NGXS Store actions
   * @param actions Actions to perform
   * @returns Observable
   */
  sequentialStoreDispatch(actions: any[]) {
    return from(actions).pipe(
      // Convert each action to Store Action
      concatMap(action => this._store.dispatch(action)),
      // Merge all actions
      toArray()
    )
  }

  /**
   * Recursively checks if a video is available
   * @param videoUrl Video URL
   */
  checkVideo(videoUrl: string): Observable<HttpResponse<any>> {
    const request = videoUrl.includes('browserstack') ? this._api.checkBrowserstackVideo(videoUrl) : this._api.checkVideoAvailable(videoUrl);
    // Recursively check
    return request.pipe(
      switchMap(res => {
        if (res.status === 206) {
          // Return response if request was successful
          return of(res);
        } else {
          // Recheck video in 2 seconds
          return of(0).pipe(
            delay(2000),
            switchMap(_ => this.checkVideo(videoUrl))
          )
        }
      })
    )
  }

  /**
   * Shows a loading snack with spinner and text while an observable/request is being done
   * @param observable Source observable
   * @param loadingText Text to show on loading snack
   */
  loadingObservable(observable: Observable<any>, loadingText: string) {
    // Default timeout 1 minute
    const timeOut = 60000;
    // Open Loading snack
    const snackRef = this._snackBar.openFromComponent(LoadingSnack, { data: loadingText, duration: timeOut, panelClass: 'loading-snack-panel' });
    return observable.pipe(
      // Close loading snack whenever the observable finishes or timeout fires
      finalize(() => snackRef.dismiss()),
      // Stop observable once timeout fires and emit error to subscriber
      timeout(timeOut)
    )
  }

  /**
   * Retrieves the HTML difference for a step result
   * @param {number} stepResultId Step Result ID
   */
  openHTMLDiff(stepResultId: number) {
    // Retrieve diff with loading string
    this.loadingObservable(
      this._api.getHTMLDiff(stepResultId).pipe(
        filter(res => !!res.diff),
        map(res => res.diff)
      ),
      'Loading HTML difference'
    ).subscribe(diff => {
      // Open Html Diff Dialog
      this._dialog.open(HtmlDiffDialog, {
        data: diff,
        width: '100vw',
        maxHeight: '80vh',
        maxWidth: '75vw'
      });
    }, err => {
      this._snack.open('An error ocurred', 'OK');
      console.log(err);
    });
  }

  editIntegration(params: IntegrationDialogData) {
    this._dialog.open(EditIntegrationDialog, { data: params });
  }

  deleteFeatureRun(run: FeatureRun) {
    return this._dialog.open(AreYouSureDialog, {
      data: {
        title: 'translate:you_sure.delete_item_title',
        description: 'translate:you_sure.delete_item_desc'
      } as AreYouSureData
    }).afterClosed().pipe(
      filter(answer => !!answer),
      switchMap(_ => this._api.removeFeatureRun(run.run_id, true, {
        loading: 'Deleting item'
      }))
    );
  }

  deleteFeatureResult(test: FeatureResult) {
    return this._dialog.open(AreYouSureDialog, {
      data: {
        title: 'translate:you_sure.delete_item_title',
        description: 'translate:you_sure.delete_item_desc'
      } as AreYouSureData
    }).afterClosed().pipe(
      filter(answer => !!answer),
      switchMap(_ => this._api.removeFeatureResult(test.feature_result_id, true, {
        loading: 'Deleting item'
      }))
    );
  }

  /**
   * Performs the overriding action through the Store
   */
  setResultStatus(result: FeatureResult, status: 'Success' | 'Failed' | '') {
    // Launch Store action to process it
    return this._api.patchFeatureResult(result.feature_result_id, { status }, {
      loading: 'Overriding status'
    });
  }

  /**
   * Performs the overriding action through the Store
   */
  setRunStatus(run: FeatureRun, status: 'Success' | 'Failed' | '') {
    // Launch Store action to process it
    return this._api.patchRun(run.run_id, { status }, {
      loading: 'Overriding status'
    });
  }

  /**
   * Archives or unarchives a feature run or a feature result
   * @param run FeatureRun
   */
  archive(run: FeatureRun | FeatureResult) {
    let request: Observable<any>;
    const word = run.archived ? 'unarchive' : 'archive';
    if (run.hasOwnProperty('run_id')) {
      // Is of type FeatureRun
      run = run as FeatureRun;
      request = this._api.patchRun(run.run_id, {
        archived: !run.archived
      })
    } else {
      // Is of type FeatureResult
      run = run as FeatureResult;
      request = this._api.patchFeatureResult(run.feature_result_id, {
        archived: !run.archived
      })
    }
    return request.pipe(
      tap(answer => {
        if (answer.success) {
          this._snack.open(`Item ${word}d successfully!`, 'OK');
        } else {
          this._snack.open(`Something went wrong on ${word}`, 'OK');
        }
      })
    );
  }

}
