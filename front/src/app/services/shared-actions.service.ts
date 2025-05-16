import { HttpResponse } from '@angular/common/http';
import { ElementRef, Injectable, ViewChild } from '@angular/core';
import { MatLegacyCheckboxChange as MatCheckboxChange } from '@angular/material/legacy-checkbox';
import { MatLegacyDialog as MatDialog } from '@angular/material/legacy-dialog';
import { MatLegacySnackBar as MatSnackBar } from '@angular/material/legacy-snack-bar';
import { Router } from '@angular/router';
import { Location } from '@angular/common';
import { LoadingSnack } from '@components/snacks/loading/loading.snack';
import {
  AreYouSureData,
  AreYouSureDialog,
} from '@dialogs/are-you-sure/are-you-sure.component';
import { EditFeature } from '@dialogs/edit-feature/edit-feature.component';
import {
  EditIntegrationDialog,
  IntegrationDialogData,
} from '@dialogs/edit-integration/edit-integration.component';
import { EditSchedule } from '@dialogs/edit-schedule/edit-schedule.component';
import { HtmlDiffDialog } from '@dialogs/html-diff/html-diff.component';
import { LiveStepsComponent } from '@dialogs/live-steps/live-steps.component';
import { MoveItemDialog } from '@dialogs/move-feature/move-item.component';
import { SureRemoveFeatureComponent } from '@dialogs/sure-remove-feature/sure-remove-feature.component';
import { Selector, Store } from '@ngxs/store';
import { CustomSelectors } from '@others/custom-selectors';
import { Features } from '@store/actions/features.actions';
import { WebSockets } from '@store/actions/results.actions';
import { StepDefinitions } from '@store/actions/step_definitions.actions';
import { FeaturesState } from '@store/features.state';
import { LoadingActions } from '@store/loadings.state';
import { deepClone } from 'ngx-amvara-toolbox';
import { from, Observable, of, BehaviorSubject, combineLatest, Subject } from 'rxjs';

import {
  concatMap,
  delay,
  finalize,
  switchMap,
  toArray,
  timeout,
  map,
  filter,
  tap,
} from 'rxjs/operators';
import { ApiService } from './api.service';
import { SocketService } from './socket.service';
import { Console } from 'console';
import { ImmutableSelector } from '@ngxs-labs/immer-adapter';
import { StarredService } from '@services/starred.service';
import { take } from 'rxjs/operators';
import { DeleteConfirmationDialogComponent } from '@components/delete-confirmation-dialog/delete-confirmation-dialog.component';


/**
 * This service is used to execute function which should be accessible from application and Tour definitions
 */
@Injectable({
  providedIn: 'root',
})
export class SharedActionsService {
  headers$ = new BehaviorSubject<ResultHeader[]>([]);
  dialogActive: boolean = false;
  dialogActiveOther: boolean = false;
  private filterStateSubject = new BehaviorSubject<boolean>(false);
  filterState$ = this.filterStateSubject.asObservable();

  public folderRunningStates = new BehaviorSubject<Map<number, boolean>>(new Map());

  public featuresRunning$ = this.folderRunningStates.asObservable();

  //Observable that tracks the selected department from dropdowns
  private selectedDepartmentSubject = new BehaviorSubject<string>('')
  selectedDepartment$ = this.selectedDepartmentSubject.asObservable();

  //  Next minor version 2.8.377
  // @ViewChild(LiveStepsComponent) liveStepsComponent!: LiveStepsComponent;

  // Motivation - pass configValueBoolean to the folder-tree component
  private configSubject = new BehaviorSubject<boolean>(false);
  config$ = this.configSubject.asObservable();


  constructor(
    public _dialog: MatDialog,
    private _store: Store,
    private _api: ApiService,
    private _snackBar: MatSnackBar,
    private _router: Router,
    private _location: Location,
    private _snack: MatSnackBar,
    private _socket: SocketService,
    private starredService: StarredService
  ) {
    this._store
      .select(CustomSelectors.RetrieveResultHeaders(false))
      .subscribe(headers => this.headers$.next(headers));
  }

  // #3414 -----------------------------------start
  // adds the ids of folders to browser url each time folders in foldertree or breadcrum are clicked
  set_url_folder_params(currentRoute: any = '') {
    // folder url base
    let folderUrl = '/new/';

    // go to newLanding if there are no folder id params in currentRoute
    if (!currentRoute) {
      this._location.go(folderUrl);
      return;
    }

    // concat folder ids to create path to clicked folder
    currentRoute.forEach(folder => {
      folderUrl += `:${folder.folder_id}`;
    });

    // change url without redirection
    this._location.go(folderUrl);
  }
  // #3414 ------------------------------------end

  // #3397 -----------------------------------start
  // clears localstorage corresponding to searchFilters(see it at ctrl + f11/features/filters)
  removeSearchFilter() {
    return this._store.dispatch(new Features.RemoveSearchFilter());
  }
  // #3397 ------------------------------------end

  goToFeature(featureId: number, openInNewWindow: boolean = false){
    const feature = this._store.selectSnapshot<Feature>(
      CustomSelectors.GetFeatureInfo(featureId)
    );
    // openInNewWindow = false
    const url = `/#/${feature.app_name}/${feature.environment_name}/${feature.feature_id}`;
        
    if (openInNewWindow) {
      window.open(url, '_blank');
    }
    else {
      this._router.navigate([
        '/',
        feature.app_name,
        feature.environment_name,
        feature.feature_id,
      ]);
    }

    // #3397 -----------------------------------start
    // remove search filter when acceding to any features
    this.removeSearchFilter();
    // #3397 -------------------------------------end
  }

  editSchedule(featureId: number) {
    const featureStore = this._store.selectSnapshot(
      FeaturesState.GetFeatureInfo
    )(featureId);
    this._dialog
      .open(EditSchedule, {
        panelClass: 'edit-schedule-panel',
        data: featureStore.feature_id,
      })
      .afterClosed()
      .subscribe(_ => (this.dialogActive = false));
  }

  handleSetting(featureId: number, type: string, event: MatCheckboxChange) {
    switch (type) {
      case 'need_help':
        return this._store.dispatch(
          new Features.PatchFeature(featureId, { need_help: event.checked })
        );
      default:
        return null;
    }
  }

  moveFeature(feature: Feature) {
    this._dialog.open(MoveItemDialog, {
      data: {
        type: 'feature',
        feature,
      } as IMoveData,
    });
  }

  moveFolder(folder: Folder) {
    this._dialog.open(MoveItemDialog, {
      data: {
        type: 'folder',
        folder,
      } as IMoveData,
    });
  }

  openLiveSteps(featureId: number) {
    return this._dialog.open(LiveStepsComponent, {
      data: featureId,
      panelClass: 'live-steps-panel',
    });
  }

  /**
   * Sends a request via WebSocket to retrieve all the occurred WS messages for a given feature
   * @param featureId Feature ID
   */
  retrieveLastFeatureSockets(featureId: number) {
    this._socket.socket &&
      this._socket.socket.emit('featurePastMessages', {
        feature_id: featureId,
      });
  }

  async run(featureId: number) {
    // Request backend to know if feature is running
    const isRunning = await this._api.isFeatureRunning(featureId).toPromise();
    const feature = this._store.selectSnapshot<Feature>(
      CustomSelectors.GetFeatureInfo(featureId)
    );
    
    if(!feature.depends_on_others){
      if (isRunning) {
        // Notify WebSocket Server to send me last websockets of feature
        this.retrieveLastFeatureSockets(featureId);
        this.openLiveSteps(featureId);
      } else {
        // Check if the feature has at least 1 browser selected, if not, show a warning
        if (feature.browsers.length > 0) {
          this._store.dispatch(new LoadingActions.SetLoading(featureId, true));
          this._api
            .runFeature(feature.feature_id, false)
            .pipe(
              filter(json => !!json.success),
              switchMap(_ =>
                this._store.dispatch(new WebSockets.FeatureTaskQueued(featureId))
              ),
              finalize(() =>
                this._store.dispatch(
                  new LoadingActions.SetLoading(featureId, false)
                )
              )
            )
            .subscribe(
              _ => {
                this._snackBar.open(
                  `Feature ${feature.feature_name} is running...`,
                  'OK'
                );
                // Open live steps dialog after starting the feature
                this.openLiveSteps(featureId);
              },
              err => {
                this._snackBar.open('An error ocurred', 'OK');
              }
            );
        } else {
          this._snackBar.open(
            "This feature doesn't have browsers selected.",
            'OK'
          );
        }
      }
    }
  }

  /**
   * Automatically open the EditFeature dialog
   * @param featureId The feature ID to edit, provide null if new
   * @param mode Defined the behavior of EditFeature
   */
  openEditFeature(
    featureId: number = null,
    mode: 'edit' | 'clone' | 'new' = 'new'
  ) {
    if (this.dialogActiveOther) {
      return;
    }

    this.dialogActiveOther = true;

    if (mode === 'edit' || mode === 'clone') {
      const feature = deepClone(
        this._store.selectSnapshot<Feature>(
          CustomSelectors.GetFeatureInfo(featureId)
        )
      ) as Feature;

      this._api
        .getFeatureSteps(featureId, {
          loading: 'translate:tooltips.loading_feature',
        })
        .subscribe(steps => {
          this._store.dispatch(
            new StepDefinitions.SetStepsForFeature(
              mode === 'clone' ? 0 : featureId,
              steps
            )
          );

          const dialogRef = this._dialog.open(EditFeature, {
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
                description: feature.description,
              },
              info: feature,
              steps: deepClone(steps),
            } as IEditFeature,
          });

          dialogRef.afterClosed().subscribe(_ => {
            this.dialogActiveOther = false;
          });
        });
    } else {
      const dialogRef = this._dialog.open(EditFeature, {
        disableClose: true,
        autoFocus: false,
        panelClass: 'edit-feature-panel',
        data: {
          mode: 'new',
          feature: {
            feature_id: 0,
            browsers: [],
          },
        } as IEditFeature,
      });

      dialogRef.afterClosed().subscribe(_ => {
        this.dialogActiveOther = false;
      });
    }
  }


  deleteFeature(featureId: number) {
    const feature = this._store.selectSnapshot<Feature>(
      CustomSelectors.GetFeatureInfo(featureId)
    );
    this._dialog.open(SureRemoveFeatureComponent, {
      data: {
        feature_name: feature.feature_name,
        feature_id: feature.feature_id,
      },
    });
  }

  openDeleteConfirmationDialog(item: any) {
    const dialogRef = this._dialog.open(DeleteConfirmationDialogComponent, {
      width: '400px',
      data: {
        title: 'Schedule Deletion',
        message: `Are you sure you want to schedule the deletion of feature "${item.name}"?`,
      },
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (result) {
        // Si el feature está en favoritos, lo quitamos
        this.starredService.isStarred(item.id).pipe(take(1)).subscribe(isStarred => {
          if (isStarred) {
            this.toggleStarred({} as Event, item.id, item.name);
          }
        });
        
        // Actualizar el item localmente
        if (item.reference) {
          item.reference.marked_for_deletion = true;
        }
        
        // Programar la eliminación usando el servicio
        this.scheduleDeletion(item.id);
        this._snackBar.open('Feature scheduled for deletion', 'OK', { duration: 2000 });
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
    );
  }

  /**
   * Recursively checks if a video is available
   * @param videoUrl Video URL
   */
  checkVideo(videoUrl: string): Observable<HttpResponse<any>> {
    const request = videoUrl.includes('browserstack')
      ? this._api.checkBrowserstackVideo(videoUrl)
      : this._api.checkVideoAvailable(videoUrl);
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
          );
        }
      })
    );
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
    const snackRef = this._snackBar.openFromComponent(LoadingSnack, {
      data: loadingText,
      duration: timeOut,
      panelClass: 'loading-snack-panel',
    });
    return observable.pipe(
      // Close loading snack whenever the observable finishes or timeout fires
      finalize(() => snackRef.dismiss()),
      // Stop observable once timeout fires and emit error to subscriber
      timeout(timeOut)
    );
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
    ).subscribe(
      diff => {
        // Open Html Diff Dialog
        this._dialog.open(HtmlDiffDialog, {
          data: diff,
          width: '100vw',
          maxHeight: '80vh',
          maxWidth: '75vw',
        });
      },
      err => {
        this._snack.open('An error ocurred', 'OK');
        console.log(err);
      }
    );
  }

  editIntegration(params: IntegrationDialogData) {
    this._dialog.open(EditIntegrationDialog, { data: params });
  }

  deleteFeatureRun(run: FeatureRun) {
    return this._dialog
      .open(AreYouSureDialog, {
        data: {
          title: 'translate:you_sure.delete_item_title',
          description: 'translate:you_sure.delete_item_desc',
        } as AreYouSureData,
      })
      .afterClosed()
      .pipe(
        filter(answer => !!answer),
        switchMap(_ =>
          this._api.removeFeatureRun(run.run_id, true, {
            loading: 'Deleting item',
          })
        )
      );
  }

  deleteFeatureResult(test: FeatureResult) {
    return this._dialog
      .open(AreYouSureDialog, {
        data: {
          title: 'translate:you_sure.delete_item_title',
          description: 'translate:you_sure.delete_item_desc',
        } as AreYouSureData,
      })
      .afterClosed()
      .pipe(
        filter(answer => !!answer),
        switchMap(_ =>
          this._api.removeFeatureResult(test.feature_result_id, true, {
            loading: 'Deleting item',
          })
        )
      );
  }

  /**
   * Performs the overriding action through the Store
   */
  setResultStatus(result: FeatureResult, status: 'Success' | 'Failed' | '') {
    // Launch Store action to process it
    return this._api.patchFeatureResult(
      result.feature_result_id,
      { status },
      {
        loading: 'Overriding status',
      }
    );
  }

  /**
   * Performs the overriding action through the Store
   */
  setRunStatus(run: FeatureRun, status: 'Success' | 'Failed' | '') {
    // Launch Store action to process it
    return this._api.patchRun(
      run.run_id,
      { status },
      {
        loading: 'Overriding status',
      }
    );
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
        archived: !run.archived,
      });
    } else {
      // Is of type FeatureResult
      run = run as FeatureResult;
      request = this._api.patchFeatureResult(run.feature_result_id, {
        archived: !run.archived,
      });
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

  async runAllFeatures(folder: Folder){
    // Create an array of observables for the running status of each feature in the folder
    const featureStatuses: Observable<boolean>[] = folder.features.map(feature => 
      this._store.select(CustomSelectors.GetFeatureRunningStatus(feature))
    );

    // Create an observable that emits the combined status of all features in the folder
    const combinedStatus$ = combineLatest(featureStatuses).pipe(
      map(statuses => statuses.some(status => status))
    );

    // Update the running state for the folder
    combinedStatus$.subscribe(isRunning => {
      const currentStates = this.folderRunningStates.getValue();
      currentStates.set(folder.folder_id, isRunning);
      this.folderRunningStates.next(new Map(currentStates));
    });

    if (folder.features.length <= 0) {
      this._snackBar.open(`No features available in this folder`, 'OK');
    } else {
      await Promise.all(folder.features.map(feature => this.run(feature)));
       // Update the running state of the folder to false after all executions are finished
      const currentStates = this.folderRunningStates.getValue();
      currentStates.set(folder.folder_id, false);
      this.folderRunningStates.next(new Map(currentStates));
    }
  }

  // Next update 2.8.77 config.json
  // async cancelAllFeatures(folder: Folder) {
  //   if (folder.features.length <= 0) {
  //     this._snack.open(`No features available in this folder`, 'OK');
  //     this._snack.open('No features available in this folder', 'OK');
  //   } else {
  //     for (const feature of folder.features) {
  //       LiveStepsComponent.stoptest();
  //       const dialogRef = this._dialog.open(LiveStepsComponent, {
  //         data: feature,
  //         panelClass: 'hidden-dialog'
  //       });
  
  //       dialogRef.afterOpened().subscribe(() => {
  //         const dialogContainer = document.querySelector('.mat-dialog-container');
  //         if (dialogContainer) {
  //           dialogContainer.setAttribute('style', 'opacity: 0; height: 0; width: 0; overflow: hidden;');
  //         }
  //         dialogRef.componentInstance.stopTest();
  //       });
  //     }
  //   }
  // }

  setFilterState(isActive: boolean) {
    this.filterStateSubject.next(isActive);
  }
  //updates the observable with new data
  setSelectedDepartment(department: string) {
    this.selectedDepartmentSubject.next(department);
  }

  /**
   * Loads the Cometa configuration and checks if the mobile test feature is enabled.
   * It retrieves the configurations from the API, finds the specific setting
   * 'COMETA_FEATURE_MOBILE_TEST_ENABLED', and updates the configSubject with its boolean value.
   */
  loadConfig() {
    this._api.getCometaConfigurations().subscribe(res => {
      const config_feature_mobile = res.find((item: any) => item.configuration_name === 'COMETA_FEATURE_MOBILE_TEST_ENABLED');
      if (config_feature_mobile) {
        const configValue = !!JSON.parse(config_feature_mobile.configuration_value.toLowerCase());
        this.configSubject.next(configValue); 
      }
    });
  }

  updateConfigValue(configValue: boolean) {
    this.configSubject.next(configValue);
  }

  toggleStarred(event: Event, featureId: number, featureName: string): void {
    event.stopPropagation();
    this.starredService.toggleStarred(featureId);
    this.starredService.starredChanges$.pipe(
      filter(event => event?.featureId === featureId),
      take(1)
    ).subscribe(event => {
      this._snackBar.open(
        event?.action === 'add' 
          ? `Feature ${featureId} (${featureName}) added to favorites` 
          : `Feature ${featureId} (${featureName}) removed from favorites`,
        'OK',
        { duration: 2000 }
      );
    });
  }
  
  scheduleDeletion(featureId: number) {
    return this._api.patchFeature(featureId, {
      marked_for_deletion: true
    }, {
      loading: 'Scheduling feature for deletion'
    }).pipe(
      tap(response => {
        if (response.success) {
          // Actualizar el estado del feature en el store
          this._store.dispatch(new Features.UpdateFeature(featureId));
          // Forzar una actualización de los features
          this._store.dispatch(new Features.GetFeatures());
          this._snackBar.open('Feature scheduled for deletion', 'OK', {
            duration: 3000
          });
        }
      })
    ).subscribe(
      () => {},
      error => {
        console.error('Error scheduling feature for deletion:', error);
        this._snackBar.open('Error scheduling feature for deletion', 'OK', {
          duration: 3000
        });
      }
    );
  }

  getMarkedForDeletionFeatures() {
    return this._store.select(CustomSelectors.GetMarkedForDeletionFeatures()).pipe(
      map(features => features.map(feature => ({
        ...feature,
        type: 'feature',
        marked_for_deletion: true,
        id: feature.feature_id,
        name: feature.feature_name,
        description: feature.description || '',
        browsers: feature.browsers || [],
        status: feature.info?.status || '',
        date: feature.info?.result_date || '',
        time: feature.info?.execution_time || 0,
        total: feature.info?.total || 0,
        help: feature.need_help || false,
        depends_on_others: feature.depends_on_others || false,
        schedule: feature.schedule || '',
        department: feature.department_name || '',
        reference: feature
      })))
    );
  }

  getActiveFeatures() {
    return this._store.select(CustomSelectors.GetActiveFeatures()).pipe(
      map(features => {
        return features.map(feature => ({
          type: 'feature',
          id: feature.feature_id,
          name: feature.feature_name,
          reference: feature,
          marked_for_deletion: false
        }));
      })
    );
  }

  restoreFeature(featureId: number) {
    return this._api.patchFeature(featureId, {
      marked_for_deletion: false
    }, {
      loading: 'Restoring feature'
    }).subscribe(
      () => {
        this._snack.open('Feature restored successfully', 'Close', {
          duration: 3000
        });
      },
      error => {
        this._snack.open('Error restoring feature', 'Close', {
          duration: 3000
        });
      }
    );
  }
}
