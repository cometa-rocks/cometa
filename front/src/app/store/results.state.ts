import { State, Action, StateContext, Selector, Store } from '@ngxs/store';
import { Injectable, NgZone } from '@angular/core';
import { getBrowserComboText, getBrowserKey } from '@services/tools';
import { MatLegacySnackBar as MatSnackBar } from '@angular/material/legacy-snack-bar';
import { Router } from '@angular/router';
import { MatLegacyDialog as MatDialog } from '@angular/material/legacy-dialog';
import { produce } from 'immer';
import { ImmutableSelector } from '@ngxs-labs/immer-adapter';
import { WebSockets } from './actions/results.actions';
import { Features } from './actions/features.actions';
import { timer } from 'rxjs';
import { ConfigState } from './config.state';

/**
 * @description Contains the state of all feature results
 * @author Alex Barba
 */
@State<IResults>({
  name: 'results',
  defaults: {
    comment:
      'This state manages the Live Steps Dialog, status of feature running and the notifications when a feature completes',
    notification_ids: [],
  },
})
@Injectable()
export class ResultsState {
  /**
   * Please see results.example.ts for a full example of the state when a test is executing
   * To easily understand the state structure
   * @see results.example.ts
   */

  constructor(
    private _snack: MatSnackBar,
    private _router: Router,
    private _dialog: MatDialog,
    private _ngZone: NgZone,
    private _store: Store
  ) {}

  /** This variable holds all timeout subscriptions */
  timeoutSubcriptions: ITimeoutSubscriptions = {};

  /**
   * Returns a unique key for using in timeout subscriptions
   * @param feature_id Feature ID
   * @param run_id Run ID
   * @param browser_info Browser object
   * @returns {string}
   */
  getTimeoutKey(
    feature_id: number,
    run_id: number,
    browser_info: BrowserstackBrowser
  ) {
    const browserKey = getBrowserKey(browser_info);
    return `${feature_id}_${run_id}_${browserKey}`;
  }

  /**
   * Clears the timeout for WebSockets
   * @param {number} feature_id Feature ID
   * @param {number} run_id Run ID
   * @param {number} browser_info Browser information object
   */
  clearTimeout(
    feature_id: number,
    run_id: number,
    browser_info: BrowserstackBrowser
  ) {
    const timeoutKey = this.getTimeoutKey(feature_id, run_id, browser_info);
    // Check timeout subscription exists
    if (this.timeoutSubcriptions[timeoutKey]) {
      // Clear timeout
      this.timeoutSubcriptions[timeoutKey].unsubscribe();
      // Delete timeout key
      delete this.timeoutSubcriptions[timeoutKey];
    }
  }

  /**
   * Resets/starts the timeout for WebSockets
   * This timeout will show a message when no WebSockets are received
   * after the initialization WebSocket is received
   * @param {number} feature_id Feature ID
   * @param {number} run_id Run ID
   * @param {number} browser_info Browser information object
   */
  resetTimeout(
    feature_id: number,
    run_id: number,
    browser_info: BrowserstackBrowser
  ) {
    this.clearTimeout(feature_id, run_id, browser_info);
    const timeoutKey = this.getTimeoutKey(feature_id, run_id, browser_info);
    // Get WebSockets Timeout from Config
    const { websocketsTimeout } =
      this._store.selectSnapshot<Config>(ConfigState);
    // Set timeout in subscription variable
    this.timeoutSubcriptions[timeoutKey] = timer(websocketsTimeout).subscribe(
      _ => {
        this._store.dispatch(
          new WebSockets.RunTimeout(feature_id, run_id, browser_info)
        );
        // Clear timeout key after setting status
        this.clearTimeout(feature_id, run_id, browser_info);
      }
    );
  }

  /**
   * @description This function takes the FeatureID, FeatureResultID and BrowserInfo as parameter
   * and returns their steps
   * @author Alex Barba
   */
  getSteps(
    state: IResults,
    feature_id: number,
    run_id: number,
    browser_info: BrowserstackBrowser
  ) {
    return state[feature_id].results[run_id][getBrowserKey(browser_info)].steps;
  }

  /**
   * @description This function takes the FeatureID, FeatureResultID, BrowserInfo and new steps as parameter
   * and returns the state feature id with the modified steps
   * @author Alex Barba
   */
  modifySteps(
    state: IResults,
    feature_id: number,
    run_id: number,
    browser_info: BrowserstackBrowser,
    newSteps: StepStatus[],
    status: string
  ) {
    state[feature_id].status = 'Running';
    state[feature_id].results[run_id][getBrowserKey(browser_info)].steps =
      newSteps;
    state[feature_id].results[run_id][getBrowserKey(browser_info)].status =
      status;
  }
  /**
   * @description This function return a mocked StepStatus object
   * @author Alex Barba
   */
  mockStep(index: number, name: string, datetime: string) {
    return {
      index: index,
      name: name,
      datetime: datetime,
      running: false,
      success: false,
    } as StepStatus;
  }

  /**
   * @description This function takes the FeatureID, FeatureResultID and BrowserInfo as parameter
   * and makes sure they exists in the current state for future updates
   * @author Alex Barba
   */
  verifyAndFixMainKeys(
    state: IResults,
    feature_id: number,
    run_id: number,
    browser_info: BrowserstackBrowser,
    status?: string,
    feature_result_id?: number
  ) {
    const browserKey = getBrowserKey(browser_info);
    // Check feature id
    if (!state.hasOwnProperty(feature_id)) {
      state[feature_id] = {
        ...state[feature_id],
        status: '',
        results: {},
        running: true,
      };
    }
    // Check feature result id
    if (!state[feature_id].results.hasOwnProperty(run_id)) {
      state[feature_id].results[run_id] = {};
    }
    // Check browser
    if (!state[feature_id].results[run_id].hasOwnProperty(browserKey)) {
      // Initialize result as empty object if not already
      // @ts-ignore
      state[feature_id].results[run_id][browserKey] =
        state[feature_id].results[run_id][browserKey] || {};
      // Declare object with changes to make
      const payload: Partial<IBrowserResult> = {
        browser_info: browser_info,
        steps: [],
        details: {},
        start_at: null,
        end_at: null,
        feature_result_id: feature_result_id || null,
      };

      // Check is status was passed to function and add it if present
      if (status) payload.status = status;
      // Merge object properties to current run - browser - result
      Object.assign(state[feature_id].results[run_id][browserKey], payload);
    }
  }

  @Action(WebSockets.RunTimeout)
  setFeatureTimeout(
    { setState }: StateContext<IResults>,
    { feature_id, run_id, browser_info }: WebSockets.RunTimeout
  ) {
    setState(
      produce((ctx: IResults) => {
        this.verifyAndFixMainKeys(
          ctx,
          feature_id,
          run_id,
          browser_info,
          'Timeout'
        );
      })
    );
  }

  @Action(WebSockets.FeatureQueued)
  setFeatureQueued(
    { setState }: StateContext<IResults>,
    {
      feature_id,
      run_id,
      browser_info,
      feature_result_id,
    }: WebSockets.FeatureQueued
  ) {
    this.resetTimeout(feature_id, run_id, browser_info);
    setState(
      produce((ctx: IResults) => {
        this.verifyAndFixMainKeys(
          ctx,
          feature_id,
          run_id,
          browser_info,
          'Queued',
          feature_result_id
        );
        ctx[feature_id].status = 'Feature Queued';
        ctx[feature_id].running = true;
      })
    );
  }

  @Action(WebSockets.FeatureInitializing)
  setFeatureInitializing(
    { setState }: StateContext<IResults>,
    {
      feature_id,
      run_id,
      browser_info,
      feature_result_id,
    }: WebSockets.FeatureInitializing
  ) {
    this.resetTimeout(feature_id, run_id, browser_info);
    setState(
      produce((ctx: IResults) => {
        this.verifyAndFixMainKeys(
          ctx,
          feature_id,
          run_id,
          browser_info,
          'Initializing',
          feature_result_id
        );
        ctx[feature_id].status = 'Initializing feature';
        ctx[feature_id].running = true;
      })
    );
  }

  @Action(WebSockets.StoppedFeature)
  setVirtualFeatureFinished(
    { setState }: StateContext<IResults>,
    { feature_id, run_id }: WebSockets.StoppedFeature
  ) {
    setState(
      produce((ctx: IResults) => {
        // Set completed to main status
        ctx[feature_id].status = 'Feature completed';
        ctx[feature_id].running = false;
        const ref = ctx[feature_id].results[run_id];
        for (const browser in ref) {
          // Set completed to all browser statuses
          if (ref[browser]) {
            ref[browser].status = 'Completed';
          }
        }
      })
    );
  }

  @Action(WebSockets.FeatureFinished)
  setFeatureFinished(
    { setState, getState, dispatch }: StateContext<IResults>,
    {
      feature_id,
      run_id,
      browser_info,
      feature_result_info,
      feature_result_id,
    }: WebSockets.FeatureFinished
  ) {
    this.clearTimeout(feature_id, run_id, browser_info);
    // Notify to the subscribed clients
    if (getState().notification_ids.includes(feature_id)) {
      this._snack
        .open(
          `Browser ${getBrowserComboText(feature_result_info.browser)} for feature ${feature_result_info.feature_name} completed!`,
          'VIEW',
          {
            duration: 5000,
            announcementMessage: 'Hide',
            horizontalPosition: 'left',
          }
        )
        .onAction()
        .subscribe(_ => {
          this._dialog.closeAll();
          this._ngZone.run(() => {
            this._router.navigate([
              '/',
              feature_result_info.app_name,
              feature_result_info.environment_name,
              feature_result_info.feature_id,
              'step',
              feature_result_id,
            ]);
          });
        });
    }
    dispatch([
      // Update feature.info using websocket info
      new Features.UpdateFeatureOffline({
        feature_id: feature_result_info.feature_id,
        info: feature_result_info,
      }),
      // Update / Create run with feature result info from websocket
      // DEPRECATED: Updating run is now done by reloading pagination
      // new Runs.UpdateRunOffline(feature_id, run_id, feature_result_info)
    ]);
    const browserKey = getBrowserKey(browser_info);
    setState(
      produce((ctx: IResults) => {
        this.verifyAndFixMainKeys(
          ctx,
          feature_id,
          run_id,
          browser_info,
          'Completed',
          feature_result_id
        );
        ctx[feature_id].results[run_id][browserKey].status = 'Completed';
        ctx[feature_id].results[run_id][browserKey].end_at = new Date();
      })
    );
  }

  @Action(WebSockets.FeatureRunCompleted)
  setRunCompleted(
    { setState }: StateContext<IResults>,
    { feature_id }: WebSockets.FeatureRunCompleted
  ) {
    setState(
      produce((ctx: IResults) => {
        // Set completed to main status
        ctx[feature_id].status = 'Feature completed';
        ctx[feature_id].running = false;
      })
    );
  }

  @Action(WebSockets.StepStarted)
  setStepStarted(
    { setState }: StateContext<IResults>,
    {
      feature_id,
      run_id,
      browser_info,
      step_name,
      step_index,
      datetime,
      feature_result_id,
    }: WebSockets.StepStarted
  ) {
    this.clearTimeout(feature_id, run_id, browser_info);
    setState(
      produce((ctx: IResults) => {
        this.verifyAndFixMainKeys(
          ctx,
          feature_id,
          run_id,
          browser_info,
          step_name,
          feature_result_id
        );
        const currentSteps = this.getSteps(
          ctx,
          feature_id,
          run_id,
          browser_info
        );
        // Check step exists
        if (typeof currentSteps[step_index] === 'undefined') {
          // Mock data
          currentSteps[step_index] = this.mockStep(
            step_index,
            step_name,
            datetime
          );
        }
        currentSteps[step_index].running = true;
        this.modifySteps(
          ctx,
          feature_id,
          run_id,
          browser_info,
          currentSteps,
          step_name
        );
        ctx[feature_id].status = step_name;
      })
    );
  }

  @Action(WebSockets.StepDetailedInfo)
  setStepDetail(
    { setState }: StateContext<IResults>,
    {
      feature_id,
      run_id,
      browser_info,
      step_index,
      datetime,
      info,
    }: WebSockets.StepDetailedInfo
  ) {
    this.clearTimeout(feature_id, run_id, browser_info);
    setState(
      produce((ctx: IResults) => {
        this.verifyAndFixMainKeys(ctx, feature_id, run_id, browser_info);
        const browserKey = getBrowserKey(browser_info);
        ctx[feature_id].results[run_id][browserKey].details[step_index] = info;
      })
    );
  }

  @Action(WebSockets.FeatureTaskQueued)
  setEmptyResult(
    { setState, getState }: StateContext<IResults>,
    { feature_id }: WebSockets.FeatureTaskQueued
  ) {
    // Set queued status only when running is false
    // This change prevents the SetQueued from being executed
    // after the Feature Initializing WebSocket
    if (!getState()[feature_id]?.running) {
      setState(
        produce((ctx: IResults) => {
          ctx[feature_id] = {
            results: {},
            running: false,
            status: 'Queued',
          };
        })
      );
    }
  }

  @Action(WebSockets.StepFinished)
  setStepFinished(
    { setState }: StateContext<IResults>,
    {
      feature_id,
      run_id,
      browser_info,
      step_index,
      step_name,
      datetime,
      step_result_info,
      step_time,
      error,
      screenshots,
      feature_result_id,
      vulnerable_headers_count,
    }: WebSockets.StepFinished
  ) {
    this.clearTimeout(feature_id, run_id, browser_info);
    setState(
      produce((ctx: IResults) => {
        this.verifyAndFixMainKeys(
          ctx,
          feature_id,
          run_id,
          browser_info,
          step_name,
          feature_result_id
        );
        const currentSteps = this.getSteps(
          ctx,
          feature_id,
          run_id,
          browser_info
        );
        // Check step exists
        if (typeof currentSteps[step_index] === 'undefined') {
          // Mock data
          currentSteps[step_index] = this.mockStep(
            step_index,
            step_name,
            datetime
          );
        }
        currentSteps[step_index] = {
          ...currentSteps[step_index],
          running: false,
          success: step_result_info.success,
          info: step_result_info,
          datetime: datetime,
          error: error,
          step_time: step_time,
          screenshots: screenshots,
          vulnerable_headers_count: vulnerable_headers_count,
        };
        this.modifySteps(
          ctx,
          feature_id,
          run_id,
          browser_info,
          currentSteps,
          step_name
        );
      })
    );
  }

  @Action(WebSockets.FeatureStarted)
  setFeatureStarted(
    { setState }: StateContext<IResults>,
    {
      feature_id,
      run_id,
      browser_info,
      start_at,
      feature_result_id,
    }: WebSockets.FeatureStarted
  ) {
    const browserKey = getBrowserKey(browser_info);
    this.resetTimeout(feature_id, run_id, browser_info);
    setState(
      produce((ctx: IResults) => {
        this.verifyAndFixMainKeys(
          ctx,
          feature_id,
          run_id,
          browser_info,
          'Starting',
          feature_result_id
        );
        ctx[feature_id].status = 'Starting feature';
        ctx[feature_id].results[run_id][browserKey].start_at = start_at;
        ctx[feature_id].running = true;
      })
    );
  }

  @Action(WebSockets.Load)
  load({ patchState }: StateContext<IResults>) {
    try {
      const notifications = JSON.parse(
        localStorage.getItem('notifications') || '[]'
      ) as number[];
      patchState({
        notification_ids: notifications,
      });
    } catch (err) {}
  }

  @Action(WebSockets.AddNotificationID)
  addNotification(
    { setState }: StateContext<IResults>,
    { feature_id }: WebSockets.AddNotificationID
  ) {
    setState(
      produce((ctx: IResults) => {
        ctx.notification_ids.push(feature_id);
        localStorage.setItem(
          'notifications',
          JSON.stringify(ctx.notification_ids)
        );
      })
    );
  }

  @Action(WebSockets.RemoveNotificationID)
  removeNotification(
    { setState }: StateContext<IResults>,
    { feature_id }: WebSockets.RemoveNotificationID
  ) {
    setState(
      produce((ctx: IResults) => {
        ctx.notification_ids = ctx.notification_ids.filter(
          id => id !== feature_id
        );
        localStorage.setItem(
          'notifications',
          JSON.stringify(ctx.notification_ids)
        );
      })
    );
  }

  @Action(WebSockets.FeatureError)
  setFeatureError(
    { setState }: StateContext<IResults>,
    {
      feature_id,
      run_id,
      browser_info,
      error,
      feature_result_id,
    }: WebSockets.FeatureError
  ) {
    this.clearTimeout(feature_id, run_id, browser_info);
    const browserKey = getBrowserKey(browser_info);
    setState(
      produce((ctx: IResults) => {
        try {
          this.verifyAndFixMainKeys(
            ctx,
            feature_id,
            run_id,
            browser_info,
            error,
            feature_result_id
          );
          ctx[feature_id].running = false;
          ctx[feature_id].results[run_id][browserKey].error = error;
        } catch (err) {}
      })
    );
  }

  @Action(WebSockets.CleanupFeatureResults)
  cleanupResults(
    { setState }: StateContext<IResults>,
    { feature_id }: WebSockets.CleanupFeatureResults
  ) {
    setState(
      produce((ctx: IResults) => {
        const featureResults = ctx[feature_id].results;
        const runsToRemove = [];
        // Check for every run
        // tslint:disable-next-line: forin
        for (const run_id in featureResults) {
          let count = 0;
          const total = Object.keys(featureResults[run_id]).length;
          // Check for every browser result
          for (const browser in featureResults[run_id]) {
            if (featureResults[run_id][browser].status === 'Completed') {
              count++;
            }
          }
          // If the total number matches the browser result count, add it to remove it later
          if (total === count) runsToRemove.push(run_id);
        }
        // Remove no longer used runs info
        for (const run_id of runsToRemove) {
          delete featureResults[run_id];
        }
        // Save state
        ctx[feature_id].results = featureResults;
      })
    );
  }

  @Selector()
  @ImmutableSelector()
  static GetFeature(state: IResults) {
    return (feature_id: number) => {
      return state[feature_id];
    };
  }

  @Selector()
  @ImmutableSelector()
  static GetFeatureStatus(state: IResults) {
    return (feature_id: number) => {
      return feature_id in state && state[feature_id].status;
    };
  }

  @Selector()
  @ImmutableSelector()
  static GetFeatureBrowserStatus(state: IResults) {
    return (feature_id: number, feature_run_id: number, browser: string) => {
      return (
        feature_id in state &&
        state[feature_id].results[feature_run_id][browser].status
      );
    };
  }

  @Selector()
  @ImmutableSelector()
  static GetFeatureRunningStatus(state: IResults) {
    return (feature_id: number) => {
      return (
        feature_id in state &&
        (state[feature_id].running || state[feature_id].status === 'Queued')
      );
    };
  }

  @Selector()
  @ImmutableSelector()
  static GetFeatureError(state: IResults) {
    return (feature_id: number) => {
      return feature_id in state && state[feature_id].error;
    };
  }

  @Selector()
  @ImmutableSelector()
  static GetNotifications(state: IResults) {
    return state.notification_ids;
  }

  @Selector()
  @ImmutableSelector()
  static GetNotificationEnabled(state: IResults) {
    return (feature_id: number) => {
      return state.notification_ids.includes(feature_id);
    };
  }

  @Selector()
  @ImmutableSelector()
  static GetLastFeatureRunID(state: IResults) {
    return (feature_id: number) => {
      const keys = Object.keys(state[feature_id].results).map(k => +k);
      return Math.max(...keys);
    };
  }

  @Selector()
  @ImmutableSelector()
  static GetLastFeatureRunSteps(state: IResults) {
    return (feature_id: number, run_id: number, browser: string) => {
      return state[feature_id].results[run_id][browser].steps;
    };
  }

  @Selector()
  @ImmutableSelector()
  static GetLastFeatureRunDetails(state: IResults) {
    return (
      feature_id: number,
      run_id: number,
      browser: string,
      index: number
    ) => {
      return state[feature_id].results[run_id][browser]?.details[index];
    };
  }
}
