import { State, Action, StateContext } from '@ngxs/store';
import { Injectable } from '@angular/core';
import produce from 'immer';
import { ApiService } from '@services/api.service';
import { tap } from 'rxjs/operators';
import { Runs } from './actions/runs.actions';

/**
 * @description Contains the state of all steps results
 * THIS STATE IS NOT USED
 * @author Alex Barba
 */
@State<IRunsState>({
  name: 'runs',
  defaults: {},
})
@Injectable()
export class RunsState {
  constructor(private _api: ApiService) {}

  @Action(Runs.GetRuns)
  setAll({ setState }: StateContext<IRunsState>, { featureId }: Runs.GetRuns) {
    return this._api.getFeatureRuns(featureId).pipe(
      tap(json => {
        setState(
          produce((ctx: IRunsState) => {
            ctx[featureId] = json;
          })
        );
      })
    );
  }

  @Action(Runs.SetRuns)
  getAll(
    { setState }: StateContext<IRunsState>,
    { featureId, runs }: Runs.SetRuns
  ) {
    setState(
      produce((ctx: IRunsState) => {
        ctx[featureId] = runs;
      })
    );
  }

  @Action(Runs.UpdateRunOffline)
  updateRunOffline(
    { setState }: StateContext<IRunsState>,
    { featureId, featureResult, runId }: Runs.UpdateRunOffline
  ) {
    setState(
      produce((ctx: IRunsState) => {
        // Get reference to current feature
        const ref = ctx[featureId];
        if (ref) {
          // Search for current run in array
          let runIndex = ref.findIndex(run => run.run_id === runId);
          if (runIndex === -1) {
            // Run not found, create it
            ref.unshift({
              archived: false,
              date_time: featureResult.result_date,
              feature_results: [],
              run_id: runId,
              status: '',
            });
            // Set index to first element just created
            runIndex = 0;
          }
          // Search for current result in feature run
          let resultIndex = ref[runIndex].feature_results.findIndex(
            res => res.feature_result_id === featureResult.feature_result_id
          );
          if (resultIndex === -1) {
            // Feature Result not found, create it
            ref[runIndex].feature_results.unshift(featureResult);
          } else {
            // Push feature result to current run array
            ref[runIndex].feature_results[resultIndex] = featureResult;
          }
        }
      })
    );
  }

  @Action(Runs.UpdateRunArchivedStatus)
  updateRunArchived(
    { setState }: StateContext<IRunsState>,
    { featureId, runId, archived }: Runs.UpdateRunArchivedStatus
  ) {
    setState(
      produce((ctx: IRunsState) => {
        // Get reference to current feature runs
        let runRef = ctx[featureId];
        // Get index of selected run
        const runIndex = runRef.findIndex(run => run.run_id === runId);
        // Assign archived value
        runRef[runIndex].archived = archived;
      })
    );
  }

  @Action(Runs.UpdateFeatureResultArchivedStatus)
  updateFeatureResultArchived(
    { setState }: StateContext<IRunsState>,
    {
      featureId,
      runId,
      featureResultId,
      archived,
    }: Runs.UpdateFeatureResultArchivedStatus
  ) {
    setState(
      produce((ctx: IRunsState) => {
        // Get reference to current feature runs
        let runRef = ctx[featureId];
        // Get index of selected run
        const runIndex = runRef.findIndex(run => run.run_id === runId);
        // Get index of selected feature result
        const resultIndex = runRef[runIndex].feature_results.findIndex(
          res => res.feature_result_id === featureResultId
        );
        // Assign archived value
        runRef[runIndex].feature_results[resultIndex].archived = archived;
      })
    );
  }

  @Action(Runs.OverrideFeatureResultStatus)
  overrideFeatureResultStatus(
    { setState }: StateContext<IRunsState>,
    { featureId, runId, resultId, status }: Runs.OverrideFeatureResultStatus
  ) {
    return this._api.patchFeatureResult(resultId, { status }).pipe(
      tap(res => {
        // Check if patch was successful
        if (res.success) {
          // Patch state
          setState(
            produce((ctx: IRunsState) => {
              // Find Run Index to modify
              const runIndex = ctx[featureId].findIndex(
                run => run.run_id === runId
              );
              if (runIndex !== -1) {
                // Find Result Index to modify
                const resultIndex = ctx[featureId][
                  runIndex
                ].feature_results.findIndex(
                  result => result.feature_result_id === resultId
                );
                if (resultIndex !== -1) {
                  // Update status
                  ctx[featureId][runIndex].feature_results[resultIndex].status =
                    status;
                }
              }
            })
          );
        }
      })
    );
  }

  @Action(Runs.OverrideFeatureRunStatus)
  overrideFeatureRunStatus(
    { setState }: StateContext<IRunsState>,
    { featureId, runId, status }: Runs.OverrideFeatureRunStatus
  ) {
    return this._api.patchRun(runId, { status }).pipe(
      tap(res => {
        // Check if patch was successful
        if (res.success) {
          // Patch state
          setState(
            produce((ctx: IRunsState) => {
              // Find Run Index to modify
              const runIndex = ctx[featureId].findIndex(
                run => run.run_id === runId
              );
              if (runIndex !== -1) {
                // Update status
                ctx[featureId][runIndex].status = status;
              }
            })
          );
        }
      })
    );
  }
}
