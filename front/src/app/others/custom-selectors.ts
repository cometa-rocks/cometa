import { createSelector } from '@ngxs/store';
import { getBrowserKey, ownFeature } from '@services/tools';
import { ApplicationsState } from '@store/applications.state';
import { ConfigState } from '@store/config.state';
import { EnvironmentsState } from '@store/environments.state';
import { FeaturesState } from '@store/features.state';
import { FeatureResultsState } from '@store/feature_results.state';
import { LogsState } from '@store/logs.state';
import { PaginationsState } from '@store/paginations.state';
import { ResultsState } from '@store/results.state';
import { StepDefinitionsState } from '@store/step-definitions.state';
import { SubscriptionsState } from '@store/subscriptions.state';
import { UserState } from '@store/user.state';
import { classifyByProperty } from 'ngx-amvara-toolbox';
import { MainViewFieldsDesktop, MainViewFieldsMobile, MainViewFieldsTabletLandscape, MainViewFieldsTabletPortrait} from '@others/variables'

/**
 * CustomSelectors is used to retrieve data, changes or calculations when changes from
 * 2 or more states are necessary to retrieve a value
 * Usage: Import CustomSelectors and use CustomSelectors.<FunctionToUse>()
 * This class does not require instatiation
 *
 * createSelector makes possible to select multiple states or other selectors at once.
 * For example:
 *   Instead of:
 *     this._store.select(PeriodsState.GetSelected).pipe(
 *       switchMap(period => <another_function_depending_on_period>)
 *     )
 *   Use:
 *     createSelector([
 *       PeriodsState.GetSelected,
 *       <another_function_depending_on_period>,
 *       <another_function_depending_on_previous_function>,
 *       etc
 *     ])
 */
export class CustomSelectors {

  /**
   * Custom Selector for retrieving permission of Edit Feature
   * @param featureId number
   * @param permission_name UserPermissions
   */
  static HasPermission(permissionName: keyof UserPermissions, feature: number | Feature) {
    return createSelector([
      FeaturesState.GetFeatureInfo,
      UserState.GetPermission(permissionName),
      UserState,
      UserState.RetrieveUserDepartments
    ], (featureFn, permitted, user, depts) => {
      if (typeof feature === 'number') {
        feature = featureFn(feature) as Feature;
      }
      return permitted || ownFeature(feature, user, depts);
    })
  }

  /**
   * Custom Selector for retrieving feature object by id
   * @param featureId number
   */
  static GetFeatureInfo(featureId: number) {
    return createSelector([FeaturesState.GetFeatureInfo], featureFn => featureFn(featureId))
  }

  /**
   * Custom Selector for retrieving feature running status
   * @param featureId number
   */
  static GetFeatureRunningStatus(featureId: number) {
    return createSelector([ResultsState.GetFeatureRunningStatus], featureFn => featureFn(featureId))
  }

  /**
   * Custom Selector for retrieving feature status
   * @param featureId number
   */
  static GetFeatureStatus(featureId: number) {
    return createSelector([ResultsState.GetFeatureStatus], featureFn => featureFn(featureId))
  }

  /**
   * Custom Selector for retrieving results for a feature
   * @param featureId number
   */
  static GetFeatureResults(featureId: number) {
    return createSelector([ResultsState.GetFeature], fn => fn(featureId));
  }

  /**
   * Custom Selector for retrieving if notifications are enabled for a given feature
   * @param featureId number
   */
  static GetNotificationEnabled(featureId: number) {
    return createSelector([ResultsState.GetNotificationEnabled], fn => fn(featureId))
  }

  /**
   * Custom Selector for retrieving last run id for a given feature
   * @param featureId number
   */
  static GetLastFeatureRunID(featureId: number) {
    return createSelector([ResultsState.GetLastFeatureRunID], fn => fn(featureId));
  }

  /**
   * Custom Selector for retrieving if feature run has error
   * @param featureId number
   */
  static GetFeatureResultsError(featureId: number) {
    return createSelector([ResultsState.GetFeatureError], fn => fn(featureId));
  }

  /**
   * Custom Selector for retrieving feature steps
   * @param featureId number
   * @param editMode EditMode
   * @param showOnlyOriginal If true for showing only the original steps defined, false to show substeps of "run feature with *"
   * @param ignoreDisabled Wether or not to show disabled steps
   */
  static GetFeatureSteps(featureId: number, editMode: EditMode = 'edit', showOnlyOriginal: boolean = true, ignoreDisabled: boolean = false) {
    return createSelector([StepDefinitionsState.GetFeatureSteps], fn => {
      let steps: FeatureStep[] = [];
      switch (editMode) {
        case 'edit':
        case 'clone':
          steps = fn(featureId);
          break;
        case 'new':
          steps = fn(0);
          break;
      }
      // Ignore disabled steps if passed
      if (ignoreDisabled) {
        steps = steps.filter(step => !!step.enabled)
      }
      // Filter accordingly too where steps are required
      const typeToFilter = showOnlyOriginal ? 'subfeature' : 'substep';
      const addLoops = typeToFilter === 'subfeature';
      return steps.filter(step => step.step_type === 'normal' || step.step_type === typeToFilter || !step.hasOwnProperty('step_type') || (addLoops && step.step_type === 'loop'));
    })
  }

  /**
   * Custom Selector for retrieving feature run steps
   * @param featureId number
   * @param runId number
   * @param browser BrowserstackBrowser
   */
  static GetLastFeatureRunSteps(featureId: number, runId: number, browser: BrowserstackBrowser) {
    const browserKey = getBrowserKey(browser);
    return createSelector([ResultsState.GetLastFeatureRunSteps], fn => fn(featureId, runId, browserKey) as StepStatus[])
  }

  /**
   * Custom Selector for retrieving feature run details
   * @param featureId number
   * @param runId number
   * @param browser BrowserstackBrowser
   */
  static GetLastFeatureRunDetails(featureId: number, runId: number, browser: BrowserstackBrowser, index: number) {
    const browserKey = getBrowserKey(browser);
    return createSelector([ResultsState.GetLastFeatureRunDetails], fn => fn(featureId, runId, browserKey, index))
  }

  /**
   * Custom Selector for retrieving feature browser status of each run
   * @param featureId number
   * @param runId number
   * @param browser BrowserstackBrowser
   */
  static GetFeatureBrowserStatus(featureId: number, runId: number, browser: BrowserstackBrowser) {
    const browserKey = getBrowserKey(browser);
    return createSelector([ResultsState.GetFeatureBrowserStatus], fn => fn(featureId, runId, browserKey))
  }

  /**
   * Custom Selector for retrieving runs for a given feature
   * @param featureId number
   */
  /* static GetFeatureRuns(featureId: number) {
    return createSelector([RunsState], (ctx: IRunsState) => ctx[featureId].concat() || []);
  } */

  // Function used in filter text pipe to replace filter template with real value
  static FilterTextFunction(filter: Filter) {
    return createSelector([
      ApplicationsState,
      UserState.RetrieveUserDepartments,
      EnvironmentsState
    ], (
      apps: Application[],
      depts: Department[],
      envs: Environment[]
    ) => {
      if (!filter) return null;
      let value = filter.text;
      try {
        switch (filter.id) {
          case 'dept':
            value = filter.text_copy.replace('$1', '<i>' + depts.find(dept => dept.department_id == filter.value).department_name + '</i>');
            break;
          case 'app':
            value = filter.text_copy.replace('$1', '<i>' + apps.find(app => app.app_id == filter.value).app_name + '</i>');
            break;
          case 'env':
            value = filter.text_copy.replace('$1', '<i>' + envs.find(env => env.environment_id == filter.value).environment_name + '</i>');
            break;
          case 'test':
            value = filter.text_copy.replace('$1', '<i>' + filter.value + '</i>');
            break;
          case 'date':
            value = filter.rangeText
              .replace('$1', '<i>' + this.formatDate(filter.range1) + '</i>')
              .replace('$2', '<i>' + this.formatDate(filter.range2) + '</i>');
            break;
          case 'steps':
            value = filter.text_copy
              .replace('$1', filter.more === '>' ? 'More than' : (filter.more === 'is' ? 'Has' : 'Less than'))
              .replace('$2', '<i>' + filter.value + '</i>');
            break;
          case 'ok':
            value = filter.text_copy
              .replace('$1', filter.more === '>' ? 'More than' : (filter.more === 'is' ? 'Has' : 'Less than'))
              .replace('$2', '<i>' + filter.value + '</i>');
            break;
        }
      } catch (err) {
        console.log(err)
      }
      return value;
    })
  }


  // Get date as human format
  static formatDate(date) {
    let d = new Date(date), month = '' + (d.getMonth() + 1), day = '' + d.getDate(), year = d.getFullYear();
    if (month.length < 2) month = '0' + month;
    if (day.length < 2) day = '0' + day;
    return [day, month, year].join('/');
  }

  static GetFeatureResultById(resultId: number) {
    return createSelector([FeatureResultsState], (ctx: IFeatureResultsState) => ctx[resultId]);
  }

  /* static GetStepResultsById(resultId: number, page: number): (ctx: IStepResultsState) => Pagination<StepResult> {
    return createSelector([StepResultsState], (ctx: IStepResultsState) => ctx[resultId][page] || {
      count: 0,
      next: null,
      previous: null,
      results: []
    });
  } */

  static GetLogById(featureResultId: number) {
    return createSelector([LogsState], (ctx: ILogsState) => {
      return ctx[featureResultId] && ctx[featureResultId].success ? ctx[featureResultId].log : '';
    });
  }

  static GetConfigProperty(property: string) {
    return createSelector([ConfigState.GetProperty], fn => fn(property));
  }

  /**
   * Retrieves the current settings object from the user info
   * @param department_id {number} Department Id
   */
  static GetDepartmentSettings(department_id: number) {
    return createSelector([UserState], (user: UserInfo) => user.departments.find(dept => dept.department_id === department_id).settings);
  }

  /**
   * Retrieves the current feature results table headers
   * It merges the saved customization on user (if existing)
   * and the one in Config State
   */
  static RetrieveResultHeaders(all: boolean = true, disableViewFields = false) {
    return createSelector([
      CustomSelectors.GetConfigProperty('tableHeaders'),
      UserState.RetrieveSettings
    ], (
      configHeaders: ResultHeader[],
      settings: any
    ) => {

      let headers: ResultHeader[] = [];
      // Check is user has saved headers in his account settings
      if (settings?.result_headers) {
        let savedHeaders = settings.result_headers as ResultHeader[];
        headers = savedHeaders;
        // Make sure headers in user settings doesn't get stuck with own headers
        // This will merge headers from the user and the ones in config.json
        configHeaders.forEach(header => {
          if (!savedHeaders.some(h => h.id === header.id)) {
            headers = headers.concat(header);
          }
        })
      } else {
        headers = configHeaders;
      }
      // Disable the run table customization checkbox if the element is hidden
      if (disableViewFields) {
        let showVariables;
        if (window.innerWidth < 600) {
          // Mobile
          showVariables = MainViewFieldsMobile
        } else if (window.innerWidth < 900) {
          // Tablet Portrait
          showVariables = MainViewFieldsTabletPortrait
        } else if (window.innerWidth < 1200) {
          // Tablet Landscape
          showVariables = MainViewFieldsTabletLandscape;
        } else {
          // Desktop
          showVariables = MainViewFieldsDesktop;
        }
        for (let i = 0 ; i < headers.length ; i++) {
          if (showVariables.includes(headers[i].id)) {
            headers[i].disabled = false;
          } else {
            headers[i].disabled = true;
          }
        }
      }
      // Return all headers or just the enabled depending on requested
      return all ? headers : headers.filter(h => h.enable)
    });
  }

  /**
   * Retrieves the pagination object for the given ID
   */
  static RetrievePagination(paginationId: string, defaultPageSize: number = 25) {
    const storageSize = localStorage.getItem(`pagination.size.${paginationId}`);
    return createSelector([PaginationsState], (paginations: IPaginationsState) => paginations[paginationId] || {
        pageIndex: 0,
        pageSize: storageSize ? parseInt(storageSize) : defaultPageSize,
        id: paginationId
      }
    )
  }

  static SubscriptionsByCloud() {
    return createSelector([
      UserState.GetSubscriptions,
      SubscriptionsState
    ], (
      active_subscriptions: Subscription[],
      subscriptions: Subscription[]
    ) => {
      const subs = subscriptions.map(sub => {
        sub.active = active_subscriptions.some(sub2 => sub2.id === sub.id);
        return sub
      })
      return Object.entries(classifyByProperty(subs, 'cloud'));
    })
  }

  static IsFolderInRoute(folder: Folder) {
    return createSelector([FeaturesState.IsFolderInRoute], (fn: ReturnType<typeof FeaturesState.IsFolderInRoute>) => fn(folder));
  }

  static GetUserAccount() {
    return createSelector([
      UserState.GetUserId
    ], (
      user: ReturnType<typeof UserState.GetUserId>
      ) => {
        return user;
      });
  }

  /**
   * Map departments as folders for new landing
   */
  static GetDepartmentFolders() {
    return createSelector([
      UserState.RetrieveUserDepartments,
      FeaturesState.GetAllFolders
    ], (
      departments: ReturnType<typeof UserState.RetrieveUserDepartments>,
      folders: ReturnType<typeof FeaturesState.GetAllFolders>
    ) => {
      return departments.map(dept => ({
        name: dept.department_name,
        folder_id: dept.department_id,
        owner: 0,
        features: [],
        type: 'department',
        department: dept.department_id,
        folders: folders.filter(folder => folder.department === dept.department_id),
        parent_id: 0
      })) as Folder[]
    })
  }

  /**
   * Map departments as folders for new landing
   */
   static GetDepartmentFoldersNew() {
    return createSelector([
      UserState.RetrieveUserDepartments,
      FeaturesState.GetAllFolders
    ], (
      departments: ReturnType<typeof UserState.RetrieveUserDepartments>,
      folders: ReturnType<typeof FeaturesState.GetAllFolders>
    ) => {
      // Map the folders to add the department level
      let foldersMapped = departments.map(dept => ({
        name: dept.department_name,
        folder_id: dept.department_id,
        owner: 0,
        features: [],
        type: 'department',
        department: dept.department_id,
        folders: folders.filter(folder => folder.department === dept.department_id),
        parent_id: 0
      })) as Folder[];
      return {
      // Map the folders to add the home level
        name: 'Home',
        folder_id: 0,
        owner: 0,
        features: [],
        type: 'home',
        department: null,
        folders: foldersMapped,
        parent_id: 0
      } as Folder;
    })
  }

}