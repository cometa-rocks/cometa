import { State, Action, StateContext, Selector, Store } from '@ngxs/store';
import { ApiService } from '@services/api.service';
import { tap } from 'rxjs/operators';
import { Injectable } from '@angular/core';
import { produce } from 'immer';
import { ImmutableSelector } from '@ngxs-labs/immer-adapter';
import { Features } from './actions/features.actions';
import { Paginations } from './actions/paginations.actions';
import { getDescendantProp } from '@services/tools';
import { CustomSelectors } from '@others/custom-selectors';
import { UserState } from './user.state';

/**
 * @description Contains the state of:
 *   - The current features search
 *   - The details of every feature once clicked
 *   - The selected filters in search page
 *   - moreOrLessSteps property, which is specific for computeEvaluation()
 * @author Alex Barba
 */
@State<IFeaturesState>({
  name: 'features',
  defaults: {
    details: {}, // Contains an object with each feature info, with ID as key
    folderDetails: {}, // Contains an object with each folder info, with ID as key
    moreOrLessSteps: 'is',
    filters: [],
    folders: {
      features: [],
      folders: []
    },
    search: '',
    currentRoute: [],
    currentRouteNew: [],
    applications: [],
    environments: [],
    departments: [],
    comment: 'This state saves the information of each each feature the user has access to and the filters of the search view.'
  }
})
@Injectable()
export class FeaturesState {

  constructor(
    public _api: ApiService,
    public _store: Store
  ) { }

  /**
   * Fetches the folders from backend
   */
  @Action(Features.GetFolders)
  getSearch({ patchState }: StateContext<IFeaturesState>) {
    return this._api.getFolders().pipe(
      tap(folders => patchState({ folders: folders }))
    );
  }

  /**
   * Fetches the feature info for a given ID
   */
  @Action(Features.UpdateFeature)
  updateFeature({ setState }: StateContext<IFeaturesState>, { feature_id }: Features.UpdateFeature) {
    return this._api.getFeature(feature_id).pipe(
      tap(feature => {
        setState(
          produce((ctx: IFeaturesState) => {
            ctx.details[feature_id] = feature;
          })
        );
      })
    );
  }

  /**
   * Programmatically adds a new featureId to main root folder
   */
  @Action(Features.PushNewFeatureId)
  pushNewFeature({ setState }: StateContext<IFeaturesState>, { feature_id }: Features.PushNewFeatureId) {
    setState(
      produce((ctx: IFeaturesState) => {
        ctx.folders.features.push(feature_id);
      })
    );
  }

  /**
   * Updates the feature info for a given ID with optional parameters
   */
  @Action(Features.UpdateFeatureOffline)
  updateFeatureOffline({ setState }: StateContext<IFeaturesState>, { feature }: Features.UpdateFeatureOffline) {
    setState(
      produce((ctx: IFeaturesState) => {
        ctx.details[feature.feature_id] = {
          ...ctx.details[feature.feature_id],
          ...feature
        }
      })
    );
  }

  @Action(Features.PatchFeature)
  patchFeature({ setState }: StateContext<IFeaturesState>, { feature_id, info }: Features.PatchFeature) {
    // Modify feature in backend
    return this._api.patchFeature(feature_id, info).pipe(
      tap(res => {
        if (res.success) {
          // Modify feature in state
          setState(
            produce((ctx: IFeaturesState) => {
              // Check existing feature info
              if (ctx.details[feature_id]) {
                // Perform fusion of changes
                ctx.details[feature_id] = { ...ctx.details[feature_id], ...info };
              }
            })
          )
        }
      })
    )
  }

  @Action(Features.RemoveFeature)
  removeFeature({ setState }: StateContext<IFeaturesState>, { feature_id }: Features.RemoveFeature) {
    setState(
      produce((ctx: IFeaturesState) => {
        delete ctx.details[feature_id];
      })
    )
  }

  @Action(Features.SetMoreOrLessSteps)
  setMoreOrLessSteps({ patchState }: StateContext<IFeaturesState>, { moreOrLess }: Features.SetMoreOrLessSteps) {
    patchState({ moreOrLessSteps: moreOrLess });
  }

  @Action(Features.SetFilters)
  setFilters({ patchState }: StateContext<IFeaturesState>, { filters }: Features.SetFilters) {
    this.saveFilters(filters);
    // Load basic filters from localStorage on App load
    const applications = filters.filter(f => f.id === 'app').map(f => +f.value);
    const environments = filters.filter(f => f.id === 'env').map(f => +f.value);
    const departments = filters.filter(f => f.id === 'dept').map(f => +f.value);
    patchState({
      filters: filters,
      applications: applications,
      environments: environments,
      departments: departments
    });
  }

  @Action(Features.AddFilter)
  addFilter({ setState, getState }: StateContext<IFeaturesState>, { filter }: Features.AddFilter) {
    const filters = [...getState().filters, filter];
    this.saveFilters(filters);
    setState(
      produce((ctx: IFeaturesState) => {
        ctx.filters = filters;
        // Manually push basic filters to state
        switch (filter.id) {
          case 'app':
            ctx.applications.push(+filter.value);
            break;
          case 'env':
            ctx.environments.push(+filter.value);
            break;
          case 'dept':
            ctx.departments.push(+filter.value);
            break;
        }
      })
    )
  }

  /**
   * Remove the search filter from the state
   * @author dph000
   * @date 14-10-21
   * @lastModification 14-10-21
   */
  @Action(Features.RemoveSearchFilter)
  removeSearchFilter({ setState }: StateContext<IFeaturesState>, { }: Features.RemoveSearchFilter) {
    setState(
      produce((ctx: IFeaturesState) => {
        const filters = [];
        ctx.filters = []; // Removes all the filters from the state
        this.saveFilters(filters); // Removes all the filters from the local storage
      })
    )
  }

  @Action(Features.RemoveFilter)
  removeFilter({ setState }: StateContext<IFeaturesState>, { filter }: Features.RemoveFilter) {
    setState(
      produce((ctx: IFeaturesState) => {
        const filters = ctx.filters.filter(f => f.id !== filter.id || f.value !== filter.value);
        this.saveFilters(filters);
        ctx.filters = filters;
        switch (filter.id) {
          case 'app':
            ctx.applications = ctx.applications.filter(app => app !== filter.value);
            break;
          case 'env':
            ctx.environments = ctx.environments.filter(env => env !== filter.value);
            break;
          case 'dept':
            ctx.departments = ctx.departments.filter(dept => dept !== filter.value);
            break;
        }
      })
    )
  }

  @Action(Features.SetFeatureInfo)
  setFeatureInfo({ patchState, getState }: StateContext<IFeaturesState>, { features }: Features.SetFeatureInfo) {
    // features can be an object with 1 feature info or an array of features
    if (Array.isArray(features)) {
      // Transform the array to an object containing each info within its feature_id
      const infos = features.reduce((r, a) => {
        r[a.feature_id] = a;
        return r;
      }, {});
      patchState({
        details: {
          ...getState().details,
          ...infos
        }
      });
    } else {
      // Just push the info within its feature_id
      const { feature_id } = features;
      patchState({
        details: {
          ...getState().details,
          [feature_id]: features
        }
      });
    }
  }

  @Action(Features.ModifyFeatureInfo)
  modifyFeatureInfo({ setState }: StateContext<IFeaturesState>, { feature_id, property, value }: Features.ModifyFeatureInfo) {
    setState(
      produce((ctx: IFeaturesState) => {
        ctx.details[feature_id][property] = value;
      })
    );
  }

  @Action(Features.AddFolderRoute)
  addFolderRoute({ setState, dispatch }: StateContext<IFeaturesState>, { folder }: Features.AddFolderRoute) {
    setState(
      produce((ctx: IFeaturesState) => {
        ctx.currentRoute.push(folder);
      })
    );
    dispatch(new Paginations.ResetPagination(['search_with_depends', 'search_without_depends']));
  }

  /**
   * Adds a folder route on the new landing
   */
  @Action(Features.NewAddFolderRoute)
  newAddFolderRoute({ setState, dispatch }: StateContext<IFeaturesState>, { folder }: Features.NewAddFolderRoute) {
    setState(
      produce((ctx: IFeaturesState) => {
        let departmentsList = this._store.select<Folder[]>(CustomSelectors.GetDepartmentFolders()); // Get the list of existing departments
        let department;
        // Adds the department variable
        departmentsList.subscribe(val => department = val.filter(department => department.department == folder.department));
        if (ctx.currentRouteNew.length == 0) {
          // Pushes the department folder when the current route length is 0, meaning the user is at root directory
          ctx.currentRouteNew.push(department[0]);
        }
        // Pushes the folder to the current route new state
        ctx.currentRouteNew.push(folder);
      })
    );
  }

  /**
   * Removes the last row from currentRouteNew, returning the user to the parent folder of the current directory
   * @author dph000
   * @date 06-10-21
   * @lastModification 06-10-21
   */
  @Action(Features.ReturnToParentRoute)
  returnToParentRoute({ setState, dispatch }: StateContext<IFeaturesState>) {
    setState(
      produce((ctx: IFeaturesState) => {
        ctx.currentRouteNew.pop(); // Removes the last row from currentRouteNew
      })
    );
  }

  /**
   * Changes the current path to the clicked one. Function designed for the new landing
   */
  @Action(Features.SetFolderRoute)
  setFolderRoute({ setState, dispatch }: StateContext<IFeaturesState>, { folder }: Features.SetFolderRoute) {
    setState(
      produce((ctx: IFeaturesState) => {
        let departmentsList = this._store.select<Folder[]>(CustomSelectors.GetDepartmentFolders()); // Get the list of existing departments
        let department;
        let path;
        // Check if the department path already exists, if not add it
        if (!folder[0]?.type) {
          // Adds the department variable
          departmentsList.subscribe(val => department = val.filter(department => department.department == folder[0]?.department));
          // Empties the folder array to save space
          department.folders = [];
          // Adds the department to the first position of the folder array
          path = [...department, ...folder];
        } else {
          // Gets the folder path
          path = folder;
        }
        path.forEach(f => delete f['route']); // Remove all the route variables
        ctx.filters = []; // Remove the filters
        ctx.currentRouteNew = path || []; // Set the new current route
      })
    );

    // #3399 ----------------------------------------------------------------------------start
    // save the last selected folder's path in localstorage in order to maintain it on reload, on view destory, etc...
    this.saveLastFolderPath(folder);
    // #3399 ------------------------------------------------------------------------------en
  }

  @Action(Features.ReturnToFolderRoute)
  returnToFolderRoute({ patchState, getState, dispatch }: StateContext<IFeaturesState>, { folderId }: Features.ReturnToFolderRoute) {
    // Removing a folder from the folders array makes no sense,
    // therefore is preferable to return to a previous folder name and remove the subsequent folders
    let currentRoute = [...getState().currentRoute];
    // Check folder id
    if (folderId) {
      const indexOfName = currentRoute.findIndex(route => route.folder_id === folderId);
      // Remove the subsequent folders
      currentRoute.splice(indexOfName + 1, currentRoute.length - indexOfName + 1);
    } else {
      // If folderId is 0 or null, it means is root folder
      currentRoute = [];
    }
    patchState({
      currentRoute: [...currentRoute]
    });
    dispatch(new Paginations.ResetPagination(['search_with_depends', 'search_without_depends']));
  }

  @Action(Features.ReturnToFolderRoute)
  newReturnToFolderRoute({ patchState, getState, dispatch }: StateContext<IFeaturesState>, { folderId }: Features.ReturnToFolderRoute) {
    // Removing a folder from the folders array makes no sense,
    // therefore is preferable to return to a previous folder name and remove the subsequent folders
    let currentRouteNew = [...getState().currentRouteNew];
    // Check folder id
    if (folderId) {
      const indexOfName = currentRouteNew.findIndex(route => route.folder_id === folderId);
      // Remove the subsequent folders
      currentRouteNew.splice(indexOfName + 1, currentRouteNew.length - indexOfName + 1);
    } else {
      // If folderId is 0 or null, it means is root folder
      currentRouteNew = [];
    }
    patchState({
      currentRouteNew: [...currentRouteNew]
    });

    // #3399 ----------------------------------------------------------------------------start
    // save the last selected folder's path in localstorage in order to maintain it on reload, on view destory, etc...
    this.saveLastFolderPath(currentRouteNew);
    // #3399 ------------------------------------------------------------------------------en

    dispatch(new Paginations.ResetPagination(['search_with_depends', 'search_without_depends']));
  }

  @Action(Features.SetDepartmentFilter)
  setDepartment({ patchState }: StateContext<IFeaturesState>, { department_id }: Features.SetDepartmentFilter) {
    patchState({ departments: department_id });
  }

  @Action(Features.SetApplicationFilter)
  setApplication({ patchState }: StateContext<IFeaturesState>, { app_id }: Features.SetApplicationFilter) {
    patchState({ applications: app_id });
  }

  @Action(Features.SetEnvironmentFilter)
  setEnvironment({ patchState }: StateContext<IFeaturesState>, { environment_id }: Features.SetEnvironmentFilter) {
    patchState({ environments: environment_id });
  }

  @Action(Features.GetFeatures)
  getFeatures({ setState }: StateContext<IFeaturesState>) {
    return this._api.getFeatures().pipe(
      tap(features => {
        // Group by FeatureID
        const featuresGrouped = features.results.reduce((r, a) => {
          const featureId = a.feature_id;
          r[featureId] = r[featureId] || {};
          r[featureId] = a;
          return r;
        }, {})
        setState(
          produce((ctx: IFeaturesState) => {
            Object.assign(ctx.details, featuresGrouped);
          })
        )
      })
    );
  }

  @Action(Features.FolderGotRemoved)
  folderGotRemoved({ patchState, getState }: StateContext<IFeaturesState>, { folder_id }: Features.FolderGotRemoved) {
    const currentRoute = getState().currentRoute;
    const index = currentRoute.findIndex(folder => folder.folder_id === folder_id);
    if (index >= 0) {
      patchState({
        currentRoute: currentRoute.slice(0, index)
      })
    }
  }

  @Action(Features.FolderGotRenamed)
  folderGotRenamed({ setState }: StateContext<IFeaturesState>, { folder }: Features.FolderGotRenamed) {
    setState(
      produce((ctx: IFeaturesState) => {
        const index = ctx.currentRoute.findIndex(folder => folder.folder_id === folder.folder_id);
        if (index >= 0) {
          // Replace folder name
          ctx.currentRoute[index].name = folder.name;
        }
      })
    )
  }

  @Selector()
  @ImmutableSelector()
  static GetFeatures(state: IFeaturesState): IFeatureStateDetail {
    return state.details;
  }

  @Selector()
  @ImmutableSelector()
  static GetCurrentRouteNew(state: IFeaturesState): Partial<Folder>[] {
    return state.currentRouteNew;
  }

  @Selector()
  @ImmutableSelector()
  static IsEasterEgg(state: IFeaturesState): boolean {
    // Returns true if one filter of type text equals Code is Poetry
    return state.filters.some(filter => filter.id === 'test' && filter.value.toString().toLowerCase() === 'code is poetry')
  }

  @Selector()
  @ImmutableSelector()
  static GetFeaturesAsArray(state: IFeaturesState): Feature[] {
    return Object.values(state.details);
  }

  saveFilters(filters: Filter[]) {
    localStorage.setItem('filters', JSON.stringify(filters));
  }

  // #3399 ------------------------------start
  saveLastFolderPath(folders: Partial<Folder>[]) {
    // save the last selected folder's path in localstorage in order to maintain it on reload, on view destory, etc...
    // this instance of localstorage is used in folder-tree.component.ts in ngOnInit().  
    localStorage.setItem('co_last_selected_folder_route', JSON.stringify(folders));
  }
  // #3399 --------------------------------end

  @Selector()
  @ImmutableSelector()
  static GetFeatureInfo(state: IFeaturesState) {
    return (feature_id: number) => {
      return state.details[feature_id];
    };
  }

  @Selector()
  @ImmutableSelector()
  static GetFilters(state: IFeaturesState): Filter[] {
    return state.filters;
  }

  @Selector()
  @ImmutableSelector()
  static IsFolderInRoute(state: IFeaturesState) {
    return (folder: Folder) => {
      return state.currentRoute.some(route => route.folder_id === folder.folder_id);
    }
  }

  @Selector()
  @ImmutableSelector()
  static GetFolders(state: IFeaturesState): Folder[] {
    return state.folders.folders;
  }

  @Selector()
  @ImmutableSelector()
  static GetSelectionFolders(state: IFeaturesState) {
    // FIXME find a better way to do this
    return location.hash != '#/new' ? state.currentRoute : state.currentRouteNew;
  }

  /**
   * Selector that returns the current route of the new landing
   */
  @Selector()
  @ImmutableSelector()
  static GetNewSelectionFolders(state: IFeaturesState) {
    return state.currentRouteNew;
  }

  @Selector()
  @ImmutableSelector()
  /**
   * Returns the feature IDs list for the current navigated route
   */
  static GetFeaturesWithinFolder(state: IFeaturesState): number[] {
    // Retrieve current folder
    const selectedFolders = state.currentRoute;
    // Default value for result is the main folder
    let result: number[] = state.folders.features;
    // If selectedFolders length is not 0 we have to evaluate the features in the selected folder
    if (selectedFolders.length !== 0) {
      // Return feature of the selected folders
      let folders = JSON.parse(JSON.stringify(state.folders)) as FoldersResponse;
      selectedFolders.forEach(value => {
        if (value.type === 'department') {
          // Filter features by selected department folder
          folders.features = folders.features.filter(f => state.details[f].department_id === value.folder_id);
        } else {
          // Filter feature by each selected folder in route
          const index = folders.folders.findIndex(folder => folder.folder_id === value.folder_id);
          folders = folders.folders[index];
          folders.features = folders.features;
        }
      });
      result = folders.features;
    }
    // Process resulting features with selected filters
    result = this.processFilters(state, result, state.details);
    return result;
  }

  static processFilters(state: IFeaturesState, features: number[], details: IFeatureStateDetail) {
    // Filter feature by selected environments, applications and/or departments
    const environments = state.environments;
    const applications = state.applications;
    const departments = state.departments;
    if (departments.length > 0) features = features.filter(feature => departments.includes(details[feature].department_id));
    if (applications.length > 0) features = features.filter(feature => applications.includes(details[feature].app_id));
    if (environments.length > 0) features = features.filter(feature => environments.includes(details[feature].environment_id));
    // Handle other kind of filters
    state.filters.forEach(filter => {
      switch (filter.id) {
        case 'test':
          // Filter features by name
          features = features.filter(feature => details[feature].feature_name.toLowerCase().includes(filter.value.toString().toLowerCase()));
          break;
        case 'steps':
        case 'ok':
        case 'fails':
        case 'skipped':
        case 'execution_time':
        case 'pixel_diff':
          // Filter features by given "greater, equal or smaller than" filters
          features = this.computeEvaluation(filter.id, features, details, filter.value, filter.more);
          break;
        case 'help':
          // Filter by "Asking for Help"
          features = features.filter(id => details[id]?.need_help)
      }
    });
    return features;
  }

  getUser() {
    let account = this._store.select(CustomSelectors.GetUserAccount());
    return account;
  }

  /**
   * Returns the state data, currently used only for testing
   */
  @Selector()
  @ImmutableSelector()
  static GetStateDAta(state: IFeaturesState, user): any {
    return (JSON.parse(JSON.stringify(state)));
  }

  /**
   * Prepares the data to be used in the table of the new landing
   * @returns the features and folders of the current route in the new landing
   * @author Álex Barba, dph000
   * @requires FeaturesState
   * @see https://redmine.amvara.de/projects/cometa/wiki/CometaFrontend
   */
  @Selector([UserState])
  @ImmutableSelector()
  static GetNewFeaturesWithinFolder(state: IFeaturesState, user): any {
    /**
     * Input: -Features
     *        -Folders
     *
     * Output: -ListItem[] - See interface ListItem for more details
     *
     * Preview:
     * | 1-rc | 2-type  | 3-refid | 4-name |  5-timestamp | 6-status   | 7-ID | 8-Name      | .... | 18-Scheduled    |
     * |------|---------|---------|--------|--------------|------------|------|-------------|------|-----------------|
     * | 1    | header  | col1    |        |              | sort asc,7 | ID   | Name        | ...  | Scheduled       |
     * | 2    | feature | 147     |        |              | sort asc,7 | 147  | Wonder Fb   | ...  | true/false      |
     * | 3    | folder  | 58      |        |              |            | 58   | WOODMARK    | ...  |  <null>         |
    */
    // Return features of the selected folders
    let folders = JSON.parse(JSON.stringify(state.folders)) as FoldersResponse;
    let result: any = {};
    let user_id = UserState.GetUserId(user); // Get the user id
    let activeList = localStorage.getItem('co_active_list'); // Get the current list status
    // Variable to know what this state does
    result.AAA_help = "This state saves the information of all the folders and features to use them subsequently in the datatable.";
    result.folderCount = 0; // Used to count how many folders are there
    result.featureCount = 0; // Used to count how many features are there
    result.rows = []; // Variable used to store all the feature and folders rows
    switch (activeList) { // Switch case to control which data to show
      case 'list':
        let search = state.filters; // Get the currently existing filters
        // If there are no filters, get the features and folders from the current directory
        if (search.length == 0) {
          // Get the data in the current directory
          folders = this.getCurrentDirectoryData(state, folders);
          // If there is any filter, filter the folders and features by it
        } else {
          // Process resulting features with selected filters
          folders = this.newProcessFilters(state, search, folders);
        }
        break;
      case 'recent':
        // Get the recently modified features list
        folders = this.getRecentFeatures(state, user_id);
        break;
      default:
        break;
    }
    // Transforms the filtered data into the new landing data structure
    result = this.transformCurrentDirectoryData(result, state, folders);
    return result;
  }

  /**
   * Gets the 10 most recent features edited by the user. Used in GetNewFeaturesWithinFolder()
   * @returns the filtered features and folders of the new landing
   * @author dph000
   * @date 04-10-21
   * @lastModification 08-10-21
   */
  static getRecentFeatures(state: IFeaturesState, user_id: number): FoldersResponse {
    let features: Feature[] = Object.values(JSON.parse(JSON.stringify(state.details))); // Get all the features
    // Filter the data rows by the modification user id, removing the rows that are not equal to the current user's id
    features = features.filter(val => val.last_edited?.user_id === user_id);
    // Sorts the features by modification date
    let sorted: any = features.sort(function (a: any, b: any) { return (b.last_edited_date < a.last_edited_date) ? -1 : 1 });
    sorted = (sorted.length > 10) ? sorted.slice(0, 10) : sorted; // Limit the results to 10 rows
    let result = { folders: [], features: sorted };
    result.features = sorted.map(val => val.feature_id); // Store only the id of each feature
    return result;
  }

  /**
   * Gets the folders and features of the current directory. Used in GetNewFeaturesWithinFolder()
   * @returns the features and folders of the current route in the new landing
   * @author dph000
   */
  static getCurrentDirectoryData(state: IFeaturesState, folders: FoldersResponse): FoldersResponse {
    // Retrieve current folder
    let currentDirectory = state.currentRouteNew;
    // Checks the length of the currentRouteNew variable. If it is 0, don't do anything as the folders variable already contains all the needed folders and features
    if (currentDirectory.length > 0) {
      // Navigates into the department and get all the features and folders
      if (currentDirectory.length == 1 && currentDirectory[0].type === 'department') {
        const department_id = state.currentRouteNew[0].folder_id; // Id of the current department
        // Gets all the features and folders of a specific department
        folders.folders = folders.folders.filter(val => val.department == department_id);
        folders.features = folders.features.filter(val => state.details[val].department_id == department_id);
      } else {
        currentDirectory.shift(); // Removes the first position of the selectedFolders array corresponding to the department
        // Navigates recursively within the folders until arriving to the current folder and get the data from there
        currentDirectory.forEach(value => {
          const index = folders.folders.findIndex(folder => folder.folder_id === value.folder_id);
          folders = folders.folders[index];
        });
      }
    }
    return folders;
  }

  /**
   * Transforms the filteres data into the new landing data structure. Used in GetNewFeaturesWithinFolder()
   * @returns the transformed data with the features and folders of the current route in the new landing
   * @author dph000
   */
  static transformCurrentDirectoryData(result, state: IFeaturesState, folders: FoldersResponse) {
    for (const id of folders.features) {
      let columns: any = {}; // Variable to store the feature values
      let feature = state.details[id]; // Variable with the feature data

      // Gets the needed variables and inserts them into the columns variable
      columns.type = "feature"; // Type of data row
      columns.orderType = feature.depends_on_others ? '3' : '2'; // set order type, makes it easy to sort groups.
      columns.reference = feature; // Reference of the feature
      columns.id = feature.feature_id; // Id of the feature
      columns.name = feature.feature_name; // Name of the feature
      columns.help = feature.need_help; // Boolean that stores if help is needed in the feature
      columns.status = feature.info?.status; // Status of the feature
      columns.date = feature.info?.result_date; // Date of the last execution
      columns.time = feature.info?.execution_time; // Elapsed time of the last execution
      columns.total = feature.info?.total; // Amount of total steps of the last execution
      columns.department = feature.department_name; // Name of the department
      columns.app = feature.app_name; // Name of the application
      columns.environment = feature.environment_name; // Name of the environment
      columns.browsers = feature.browsers; // List of browsers used to test the feature
      columns.schedule = feature.schedule; // Schedule to said feature
      columns.depends_on_others = feature.depends_on_others;
      columns.modification = feature.last_edited_date; // Last modification date
      columns.modification_user_id = feature.last_edited?.user_id; // Id of the last modifier
      result.featureCount += 1;
      // Pushes the columns into the object
      result.rows.push(columns);
    }
    // Loop over folder and add the information from folder to our new array
    for (const folder of folders.folders) {
      let columns: any = {}; // Variable to store the folder values

      // Gets the needed variables and inserts them into the columns variable
      // The variables that equal null are there to avoid problems during data show with the material table
      columns.type = "folder";
      columns.orderType = '1'; // set order type, makes it easy to sort groups.
      columns.reference = folder; // Reference of the folder
      columns.id = folder.folder_id; // Id of the folder
      columns.name = folder.name; // Name of the folder
      columns.help = null;
      columns.status = null;
      columns.date = null;
      columns.time = null;
      columns.total = null;
      columns.department = folder.department; // Name of the department
      columns.app = null;
      columns.environment = null;
      columns.browsers = null;
      columns.schedule = null;
      columns.depends_on_others = null;
      columns.route = folder.route || [...JSON.parse(JSON.stringify(state.currentRouteNew)), folder]; // The whole route to the folder
      result.folderCount += 1;
      // Pushes the columns into the object
      result.rows.push(columns);
    }
    result.last_update = new Date(); // Add the date of the last update of the variable
    return result;
  }

  /**
   * Gets recursivelly all the data from inside each folder
   * @returns the filtered data
   * @author dph000
   * @date 24-09-21
   * @lastModification 01-10-21
   */
  static getRecursiveData(state: IFeaturesState, results, folder: Folder, filter_name: string, route: Folder[]) {
    // Recursivity that goes over all the folders
    folder.folders.forEach(currentFolder => {
      let currentRoute: Folder[] = [...route, currentFolder]; // Add the current route to the parent route (if exists)
      results = this.getRecursiveData(state, results, currentFolder, filter_name, currentRoute);
    });
    // Get the features data as an []
    folder.features.forEach(val => {
      if (state.details[val].feature_name.toLowerCase().includes(filter_name) || state.details[val].feature_id.toString().includes(filter_name)) {
        results.features.push(val);
      }
    });
    // Pushes the folder if it satisfies the filter
    if (folder.name.toLowerCase().includes(filter_name) || folder.folder_id.toString().includes(filter_name)) {
      folder.route = route;
      folder.folders = []
      results.folders.push(folder);
    }
    return results;
  }

  /**
   * Processes the existing filters. Used in GetNewFeaturesWithinFolder()
   * @returns the filtered features and folders of the new landing
   * @author dph000
   * @lastModification 01-10-21
   */
  static newProcessFilters(state: IFeaturesState, search, folderList: FoldersResponse): FoldersResponse {
    let results = { features: [], folders: [] } as FoldersResponse;
    let filter_name = search[0].value.toString().toLowerCase(); // Filter value
    // Filter the features located in the root and push them to the array if they satisfy the filter
    folderList.features = folderList.features.filter(val => {
      if (state.details[val].feature_name.toLowerCase().includes(filter_name) || state.details[val].feature_id.toString().includes(filter_name)) {
        results.features.push(val);
      }
    });
    // Recursively get the data from all the available folders and departments
    folderList.folders.forEach(folder => {
      let route: Folder[] = [folder]; // Add the current route
      results = this.getRecursiveData(state, results, folder, filter_name, route);
    });
    return results;
  }

  @Selector()
  @ImmutableSelector()
  static GetFoldersWithinFolder(state: IFeaturesState): Folder[] {
    // Same as `GetFeaturesWithinFolder` but returns folders
    const selectedFolders = state.currentRoute;
    const departments = state.filters.filter(filter => filter.id === 'dept').map(filter => filter.value);
    let folders: Folder[] = [];
    if (selectedFolders.length === 0) {
      folders = state.folders.folders;
    } else {
      // @ts-ignore
      let features = state.folders;
      selectedFolders.forEach(value => {
        if (value.type === 'department') {
          // Filter features by selected department folder
          features.folders = features.folders.filter(f => f.department === value.folder_id);
        } else {
          const index = features.folders.findIndex(folder => folder.folder_id === value.folder_id);
          features = features.folders[index];
        }
      });
      folders = features.folders;
    }
    if (departments.length > 0) {
      folders = folders.filter(folder => departments.includes(folder.department))
    }
    return folders;
  }

  /**
   * Gets and returns the folder hierarchy for the new landing
   */
  @Selector()
  @ImmutableSelector()
  static GetNewFoldersWithinFolder(state: IFeaturesState): Folder[] {
    // Same as `GetFeaturesWithinFolder` but returns folders
    const selectedFolders = state.currentRouteNew;
    const departments = state.filters.filter(filter => filter.id === 'dept').map(filter => filter.value);
    let folders: Folder[] = [];
    if (selectedFolders.length === 0) {
      folders = state.folders.folders;
    } else {
      // @ts-ignore
      let features = state.folders;
      selectedFolders.forEach(value => {
        if (value.type === 'department') {
          // Filter features by selected department folder
          features.folders = features.folders.filter(f => f.department === value.folder_id);
        } else {
          const index = features.folders.findIndex(folder => folder.folder_id === value.folder_id);
          features = features.folders[index];
        }
      });
      folders = features.folders;
    }
    if (departments.length > 0) {
      folders = folders.filter(folder => departments.includes(folder.department))
    }
    return folders;
  }

  @Selector()
  static GetLastFolder(state: IFeaturesState) {
    if (state.currentRouteNew.length > 0) {
      return state.currentRouteNew[state.currentRouteNew.length - 1].folder_id;
    } else {
      return 0;
    }
  }

  @Selector()
  static GetAllFolders(state: IFeaturesState) {
    return state.folders.folders;
  }

  static computeEvaluation(field: string, features: number[], details: IFeatureStateDetail, value: number | string, moreOrLessSteps: string): number[] {
    const fields = ['ok', 'fails', 'skipped', 'execution_time', 'pixel_diff'];
    if (fields.includes(field))
      field = 'info.' + field;
    switch (moreOrLessSteps) {
      case '>':
        return features.filter(feature => getDescendantProp(details[feature], field) > parseInt(value.toString(), 10));
      case 'is':
        return features.filter(feature => getDescendantProp(details[feature], field) === parseInt(value.toString(), 10));
      case '<':
        return features.filter(feature => getDescendantProp(details[feature], field) < parseInt(value.toString(), 10));
      default:
        return features;
    }
  }

}
