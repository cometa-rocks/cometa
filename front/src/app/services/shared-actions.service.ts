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
import { BrowserstackState } from '@store/browserstack.state';
import { BrowsersState } from '@store/browsers.state';
import { deepClone } from 'ngx-amvara-toolbox';
import { from, Observable, of, BehaviorSubject, combineLatest, Subject, firstValueFrom } from 'rxjs';

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
        panelClass: 'no-resize-dialog',
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
        autoFocus: true,
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
        autoFocus: true,
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
  setResultStatus(result: FeatureResult, status: 'Success' | 'Failed' | 'Canceled' | '') {
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

  /**
   * IMPROVED: Runs all features in a folder, skipping those with outdated browsers
   * @param folder - Folder object with properties: features (array of feature IDs)
   */
  async runAllFeatures(folder: any){
    try {
      // Validate folder object structure
      if (!folder) {
        this._snackBar.open('Error: Invalid folder object provided', 'OK', { duration: 5000 });
        return;
      }

      if (!folder.features || !Array.isArray(folder.features)) {
        this._snackBar.open('Error: Folder does not have valid features array', 'OK', { duration: 5000 });
        return;
      }

      if (folder.features.length === 0) {
        this._snackBar.open('This folder has no features to run', 'OK', { duration: 3000 });
        return;
      }

      // IMPROVED: Get detailed information about which features can and cannot run
      const featureStatus = await this.getFolderFeatureStatus(folder);
      
      if (featureStatus.canRunFeatures === 0) {
        this._snackBar.open(
          `No features with valid browsers available in this folder. ${featureStatus.totalFeatures} feature(s) have outdated browsers.`, 
          'OK', 
          { duration: 5000 }
        );
        return;
      }

      // Show detailed information about what will be run
      if (featureStatus.invalidFeatures.length > 0) {
        this._snackBar.open(
          `Skipped ${featureStatus.invalidFeatures.length} feature(s) with outdated browsers. Running ${featureStatus.canRunFeatures} feature(s) with valid browsers.`, 
          'OK', 
          { duration: 5000 }
        );
      } else {
        this._snackBar.open(
          `Running all ${featureStatus.canRunFeatures} features in this folder.`, 
          'OK', 
          { duration: 3000 }
        );
      }

      // IMPROVED: Validate that all features still exist before running
      const validFeatures = await this.validateFeaturesExist(featureStatus.validFeatures);
      
      if (validFeatures.length === 0) {
        this._snackBar.open(
          'No valid features found to run. Some features may have been deleted.', 
          'OK', 
          { duration: 5000 }
        );
        return;
      }

      // Create an array of observables for the running status of each valid feature in the folder
      const featureStatuses: Observable<boolean>[] = validFeatures.map(feature => 
        this._store.select(CustomSelectors.GetFeatureRunningStatus(feature))
      );

      // Create an observable that emits the combined status of all valid features in the folder
      const combinedStatus$ = combineLatest(featureStatuses).pipe(
        map(statuses => statuses.some(status => status))
      );

      // Update the running state for the folder
      combinedStatus$.subscribe(isRunning => {
        const currentStates = this.folderRunningStates.getValue();
        currentStates.set(folder.folder_id, isRunning);
        this.folderRunningStates.next(new Map(currentStates));
      });

      // Run only the valid features
      await Promise.all(validFeatures.map(feature => this.run(feature)));
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Update the running state of the folder to false after all executions are finished
      const currentStates = this.folderRunningStates.getValue();
      currentStates.set(folder.folder_id, false);
      this.folderRunningStates.next(new Map(currentStates));
      
      // IMPROVED: Monitor folder state for potential issues
      this.monitorFolderState(folder.folder_id);
    } catch (error) {
      this._snackBar.open(
        'Error running features. Some features may have been deleted or are no longer accessible.', 
        'OK', 
        { duration: 5000 }
      );
      
      // Clear folder running state on error
      const currentStates = this.folderRunningStates.getValue();
      currentStates.set(folder.folder_id, false);
      this.folderRunningStates.next(new Map(currentStates));
    }
  }

  /**
   * IMPROVED: Validate that features still exist before running them
   * This prevents errors when features are deleted while the operation is in progress
   */
  private async validateFeaturesExist(featureIds: number[]): Promise<number[]> {
    const validFeatures: number[] = [];
    
    for (const featureId of featureIds) {
      try {
        const featureInfo = await firstValueFrom(
          this._store.select(CustomSelectors.GetFeatureInfo(featureId))
        );
        
        if (featureInfo) {
          validFeatures.push(featureId);
        } else {
          console.warn(`⚠️ Feature ${featureId} no longer exists, skipping`);
        }
      } catch (error) {
        console.warn(`⚠️ Error validating feature ${featureId}:`, error);
      }
    }
    
    return validFeatures;
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
    
    // Clear feature cache when department changes to ensure fresh data
    this.clearFeatureCache();
  }

  /**
   * IMPROVED: Filters features to only include those with valid (non-outdated) browsers
   * This ensures that runAllFeatures only executes features that can actually run
   */
  public async filterFeaturesWithValidBrowsers(features: number[]): Promise<number[]> {
    const validFeatures: number[] = [];
    
    for (const featureId of features) {
      try {
        // Check if this feature has outdated browsers
        const hasOutdatedBrowsers = await this.checkFeatureBrowserStatus(featureId);
        
        if (!hasOutdatedBrowsers) {
          validFeatures.push(featureId);
        }
      } catch (error) {
        // If we can't determine browser status, BLOCK the feature for safety
        // Don't add to validFeatures - it will be blocked
      }
    }
    
    return validFeatures;
  }

  /**
   * IMPROVED: Gets detailed information about which features can and cannot run
   * Returns an object with valid and invalid features for better user feedback
   * @param folder - Folder object with properties: features (array of feature IDs)
   * DEBUG: Enhanced with detailed validation information
   * IMPROVED: Better handling when browsers are not loaded
   */
  public async getFolderFeatureStatus(folder: any): Promise<{
    validFeatures: number[],
    invalidFeatures: number[],
    totalFeatures: number,
    canRunFeatures: number,
    detailedInfo: any[],
    debugSummary: string,
    browserStatus: string
  }> {
    const validFeatures: number[] = [];
    const invalidFeatures: number[] = [];
    const detailedInfo: any[] = [];
    
    // IMPROVED: Check browser status first
    const availableBrowsers = this._store.selectSnapshot(BrowserstackState.getBrowserstacks) as any[];
    const browserStatus = availableBrowsers && availableBrowsers.length > 0 
      ? `✅ ${availableBrowsers.length} Browserstack browsers available`
      : `⚠️ No Browserstack browsers loaded - validation may be incomplete`;
    
    
    for (const featureId of folder.features) {
      try {
        
        const hasOutdatedBrowsers = await this.checkFeatureBrowserStatus(featureId);
        const browserDetails = await this.testBrowserChecking(featureId);
        
        if (hasOutdatedBrowsers) {
          invalidFeatures.push(featureId);
        } else {
          validFeatures.push(featureId);
        }
        
        detailedInfo.push({
          featureId,
          hasOutdatedBrowsers,
          browserDetails
        });
      } catch (error) {
        // If we can't determine, BLOCK the feature for safety
        invalidFeatures.push(featureId);
        detailedInfo.push({
          featureId,
          hasOutdatedBrowsers: true,
          browserDetails: null,
          error: error.message,
          reason: 'Could not determine browser status - blocked for safety'
        });
      }
    }
    
    const debugSummary = `
      🔍 VALIDATION DEBUG SUMMARY:
      Total features: ${folder.features.length}
      Valid features: ${validFeatures.length} [${validFeatures.join(', ')}]
      Invalid features: ${invalidFeatures.length} [${invalidFeatures.join(', ')}]
      Can run: ${validFeatures.length}
      Browser status: ${browserStatus}
    `.trim();
    
    return {
      validFeatures,
      invalidFeatures,
      totalFeatures: folder.features.length,
      canRunFeatures: validFeatures.length,
      detailedInfo,
      debugSummary,
      browserStatus
    };
  }

  /**
   * IMPROVED: Test method to verify browser checking functionality
   * FOCUS: Only validates Browserstack browsers
   * STRICT: Shows detailed validation results
   */
  public async testBrowserChecking(featureId: number): Promise<{
    hasOutdatedBrowsers: boolean,
    browserDetails: any[],
    featureInfo: any,
    validationSummary: string
  }> {
    try {
      const featureInfo = await firstValueFrom(
        this._store.select(CustomSelectors.GetFeatureInfo(featureId))
      );
      
      if (!featureInfo || !featureInfo.browsers) {
        return {
          hasOutdatedBrowsers: true,
          browserDetails: [],
          featureInfo: featureInfo,
          validationSummary: 'No feature info or browsers found - BLOCKED'
        };
      }
      
      // Get available Browserstack browsers
      const availableBrowsers = this._store.selectSnapshot(BrowserstackState.getBrowserstacks) as any[];
      
      if (!availableBrowsers || availableBrowsers.length === 0) {
        return {
          hasOutdatedBrowsers: true,
          browserDetails: [],
          featureInfo: featureInfo,
          validationSummary: 'No Browserstack browsers available - BLOCKED'
        };
      }
      
      const browserDetails = featureInfo.browsers.map(browser => ({
        browser: browser.browser,
        version: browser.browser_version,
        os: browser.os,
        isLocal: !browser.os,
        isOutdated: browser.os ? this.isCloudBrowserOutdated(browser, availableBrowsers) : false,
        reason: this.getBrowserOutdatedReason(browser)
      }));
      
      const hasOutdatedBrowser = browserDetails.some(browser => browser.isOutdated);
      const localBrowsers = browserDetails.filter(browser => !browser.os);
      const cloudBrowsers = browserDetails.filter(browser => browser.os);
      const outdatedCloudBrowsers = cloudBrowsers.filter(browser => browser.isOutdated);
      
      const validationSummary = `
        Total browsers: ${browserDetails.length}
        Local browsers: ${localBrowsers.length} (always valid)
        Cloud browsers: ${cloudBrowsers.length}
        Outdated cloud browsers: ${outdatedCloudBrowsers.length}
        Final result: ${hasOutdatedBrowser ? 'BLOCKED' : 'ALLOWED'}
      `.trim();
      
      return {
        hasOutdatedBrowsers: hasOutdatedBrowser,
        browserDetails,
        featureInfo: featureInfo,
        validationSummary
      };
    } catch (error) {
      return {
        hasOutdatedBrowsers: true,
        browserDetails: [],
        featureInfo: null,
        validationSummary: `Error during validation: ${error.message} - BLOCKED`
      };
    }
  }

  /**
   * IMPROVED: Get detailed reason why a browser is considered outdated
   * This helps with debugging and user feedback
   * FOCUS: Only validates Browserstack browsers
   */
  private getBrowserOutdatedReason(browser: any): string {
    try {
      if (browser.browser_version === 'latest') {
        return 'Latest version - never outdated';
      }
      
      // FOCUS: Only validate cloud browsers (Browserstack) - skip local browsers
      if (!browser.os) {
        return 'Local browser - not validated';
      }
      
      // Get only Browserstack browsers
      const availableBrowsers = this._store.selectSnapshot(BrowserstackState.getBrowserstacks) as any[];
      
      if (!availableBrowsers || availableBrowsers.length === 0) {
        return 'No Browserstack browsers available for comparison';
      }
      
      // Use the same logic as the component for cloud browsers
      const isOutdated = this.isCloudBrowserOutdated(browser, availableBrowsers);
      if (isOutdated) {
        return `Browserstack browser ${browser.browser} ${browser.browser_version} not found in available browsers`;
      }
      
      return 'Browserstack browser is up to date';
    } catch (error) {
      return 'Error checking browser status';
    }
  }

  /**
   * IMPROVED: Checks if a specific feature has outdated browsers
   * Returns true if browsers are outdated, false if they're valid
   * 
   * FOCUS: Only validates Browserstack browsers using the same logic as the component
   * IMPROVED: Fallback validation when browsers can't be loaded from store
   * DEBUG: Enhanced with detailed logging
   */
  public async checkFeatureBrowserStatus(featureId: number): Promise<boolean> {
    let featureInfo: any = null;
    
    try {
      
      // Get feature info from store to check browser configuration
      featureInfo = await firstValueFrom(
        this._store.select(CustomSelectors.GetFeatureInfo(featureId))
      );
      
      if (!featureInfo) {
        return true;
      }
      
      if (!featureInfo.browsers || featureInfo.browsers.length === 0) {
        return true;
      }
      
 
      
      // FOCUS: Only get Browserstack browsers (no local browsers)
      let availableBrowsers = this._store.selectSnapshot(BrowserstackState.getBrowserstacks) as any[];
      
      // IMPROVED: If no browsers available, try to dispatch the action to load them
      if (!availableBrowsers || availableBrowsers.length === 0) {
       
        
        // Try to dispatch the action to load browsers
        const { Browserstack } = await import('@store/actions/browserstack.actions');
        this._store.dispatch(new Browserstack.GetBrowserstack());
        
        // Wait a bit and check again
        await new Promise(resolve => setTimeout(resolve, 1000));
        availableBrowsers = this._store.selectSnapshot(BrowserstackState.getBrowserstacks) as any[];
        
        if (!availableBrowsers || availableBrowsers.length === 0) {
          // FALLBACK: Use basic validation when we can't get browsers from store
          return this.fallbackBrowserValidation(featureInfo.browsers);
        }
      }
      
      // Check each browser using the SAME logic as the component for cloud browsers
      const browsers = featureInfo.browsers;
      const hasOutdatedBrowser = browsers.some(browser => {
      
        
        // Only validate cloud browsers (Browserstack) - skip local browsers
        if (browser.os) {
          const isOutdated = this.isCloudBrowserOutdated(browser, availableBrowsers);
          return isOutdated;
        } else {
          
          return false;
        }
      });
      return hasOutdatedBrowser;
    } catch (error) {
      
      // If we can't determine due to error - use fallback validation
      return this.fallbackBrowserValidation(featureInfo?.browsers || []);
    }
  }

  /**
   * FALLBACK: Dynamic browser validation when store browsers are not available
   * This uses the SAME logic as the component: comparing with available versions
   */
  private fallbackBrowserValidation(browsers: any[]): boolean {
    
    // IMPROVED: Try to get browsers from store one more time
    const availableBrowsers = this._store.selectSnapshot(BrowserstackState.getBrowserstacks) as any[];
    const localBrowsers = this._store.selectSnapshot(BrowsersState.getBrowserJsons) as any[];
    
    if (availableBrowsers && availableBrowsers.length > 0) {

      return this.dynamicBrowserValidation(browsers, availableBrowsers, localBrowsers);
    }
    
    // Conservative approach: block all cloud browsers if we can't determine
    return browsers.some(browser => {
      if (!browser.os) {
        return false;
      }
      
      if (browser.browser_version === 'latest') {
        return false;
      }
      return true;
    });
  }

  /**
   * DYNAMIC: Uses the exact same logic as the component for browser validation
   * Compares with available versions instead of hardcoded thresholds
   */
  private dynamicBrowserValidation(browsers: any[], availableBrowsers: any[], localBrowsers: any[]): boolean {
    
    const allAvailableBrowsers = [...availableBrowsers, ...localBrowsers];
    
    return browsers.some(browser => {
      
      // Skip local browsers (no OS property)
      if (!browser.os) {
        return false;
      }
      
      // Skip 'latest' versions
      if (browser.browser_version === 'latest') {
        return false;
      }
      
      // Use the EXACT same logic as the component
      if (this.isLocalBrowser(browser) && browser.browser === 'chrome') {
        return this.isLocalChromeOutdated(browser, allAvailableBrowsers);
      } else {
        return this.isCloudBrowserOutdated(browser, allAvailableBrowsers);
      }
    });
  }

  /**
   * FOCUS: Only validates Browserstack browsers
   * Local browsers are not validated and considered always valid
   */
  private isLocalBrowser(browser: any): boolean {
    return !browser.os;
  }

  /**
   * DYNAMIC: Check if a local Chrome browser is outdated (SAME logic as component)
   * Compares with available versions instead of hardcoded thresholds
   */
  private isLocalChromeOutdated(selectedBrowser: any, availableBrowsers: any[]): boolean {
    // Get all available Chrome versions (both local and cloud)
    const chromeBrowsers = availableBrowsers.filter(browser => 
      browser.browser === 'chrome'
    );
    
    if (chromeBrowsers.length === 0) {
      return false; // Can't determine, allow running (same as component)
    }
    
    // Extract version numbers and convert to integers for comparison
    const availableVersions = chromeBrowsers.map(browser => {
      const version = browser.browser_version;
      if (version === 'latest') return 999; // Latest is always highest
      return parseInt(version, 10) || 0;
    }).sort((a, b) => b - a); // Sort descending
    
    const selectedVersion = selectedBrowser.browser_version;
    if (selectedVersion === 'latest') {
      return false; // Latest is never outdated
    }
    
    const selectedVersionNum = parseInt(selectedVersion, 10) || 0;
    
    // Check if selected version is significantly outdated (more than 3 versions behind)
    const highestAvailable = availableVersions[0];
    
    // For Chrome, be more strict - if it's more than 3 versions behind, consider it outdated
    if (highestAvailable - selectedVersionNum > 3) {
      return true;
    }
    return false;
  }

  /**
   * IMPROVED: Check if a cloud browser is outdated (SAME logic as component)
   * DEBUG: Enhanced with detailed logging
   */
  private isCloudBrowserOutdated(selectedBrowser: any, availableBrowsers: any[]): boolean {
    
    // If the browser version is 'latest', it's never outdated
    if (selectedBrowser.browser_version === 'latest') {
      return false;
    }
    
    // Find matching available browser by OS, OS version, browser type, and browser version
    const matchingAvailableBrowser = availableBrowsers.find((availableBrowser: any) => {
      const osMatch = availableBrowser.os === selectedBrowser.os;
      const osVersionMatch = availableBrowser.os_version === selectedBrowser.os_version;
      const browserMatch = availableBrowser.browser === selectedBrowser.browser;
      const browserVersionMatch = availableBrowser.browser_version === selectedBrowser.browser_version;
      
      const isMatch = osMatch && osVersionMatch && browserMatch && browserVersionMatch;
      
      return isMatch;
    });

    // If no matching browser is found, it means the version is outdated/not available
    if (!matchingAvailableBrowser) {
      return true;
    }
    return false;
  }

  /**
   * Clears the feature cache when department changes
   * Uses dynamic import to avoid circular dependencies
   */
  private async clearFeatureCache() {
    try {
      // Dynamically import the component to avoid circular dependencies
      const { L1FeatureItemListComponent } = await import('@components/l1-feature-item-list/l1-feature-item-list.component');
      L1FeatureItemListComponent.clearAllCache();
    } catch (error) {
      // Silent error handling
    }
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

  /**
   * IMPROVED: Monitor folder state after execution to detect potential issues
   * This helps identify problems that occur after the main execution is complete
   */
  private monitorFolderState(folderId: number): void {
    
    // Monitor for 5 minutes to catch delayed errors
    const monitorInterval = setInterval(() => {
      const currentStates = this.folderRunningStates.getValue();
      const folderState = currentStates.get(folderId);
      
      // If folder is still marked as running after 5 minutes, reset it
      if (folderState === true) {
        currentStates.set(folderId, false);
        this.folderRunningStates.next(new Map(currentStates));
      }
    }, 60000); // Check every minute
    
    // Stop monitoring after 5 minutes
    setTimeout(() => {
      clearInterval(monitorInterval);
    }, 300000); // 5 minutes
  }
  
}
