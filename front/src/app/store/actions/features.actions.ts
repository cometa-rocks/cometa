/**
 * Feature Actions for features.state.ts
 * This actions manages all features info, folders and options of the Search page
 */
export namespace Features {
  /**
   * @description Makes a request to get all features based on the Application and/or Environment
   */
  export class GetFolders {
    static readonly type = '[Features] Get Folders';
  }

  /**
   * @description Makes a request to update a specific feature with new info
   * @param {number} feature_id Feature ID
   */
  export class UpdateFeature {
    static readonly type = '[Features] Update feature';
    constructor(public feature_id: number) {}
  }

  /**
   * @description Update specific feature with new info with local info
   * @param {number} feature_id Feature ID
   * @param {Partial<Feature>} info Feature object (any property is optional)
   */
  export class UpdateFeatureOffline {
    static readonly type = '[Features] Update feature offline';
    constructor(public feature: Partial<Feature>) {}
  }

  /**
   * @description Update specific feature in request and saves modified object in state
   * @param {number} feature_id Feature ID
   * @param {Partial<Feature>} info Feature object (any property is optional)
   */
  export class PatchFeature {
    static readonly type = '[Features] Patch feature';
    constructor(
      public feature_id: number,
      public info: Partial<Feature>
    ) {}
  }

  /**
   * @description Puts a given feature id to main folder, usually for when creating a new feature
   * @param {number} feature_id Feature ID
   */
  export class PushNewFeatureId {
    static readonly type = '[Features] Push new feature id';
    constructor(public feature_id: number) {}
  }

  /**
   * @description Removes the details of a feature
   * @param {number} feature_id Feature ID
   */
  export class RemoveFeature {
    static readonly type = '[Features] Remove feature';
    constructor(public feature_id: number) {}
  }

  /**
   * @description Sets the moreOrLessStepsProperty
   * @param {string} moreOrLess
   */
  export class SetMoreOrLessSteps {
    static readonly type = '[Features] Set MoreOrLessSteps';
    constructor(public moreOrLess: string) {}
  }

  /**
   * @description Sets the actual filters for the search page
   * @param {Filter[]} filters Filters for search
   */
  export class SetFilters {
    static readonly type = '[Features] Set Filters';
    constructor(public filters: Filter[]) {}
  }

  /**
   * @description Adds a filter to search page
   * @param {Filter} filter Filter to add
   */
  export class AddFilter {
    static readonly type = '[Features] Add Filter';
    constructor(public filter: Filter) {}
  }

  /**
   * @description Removes a filter to search page
   * @param {Filter} filter Filter to remove
   */
  export class RemoveFilter {
    static readonly type = '[Features] Remove Filter';
    constructor(public filter: Filter) {}
  }

  /**
   * @description Removes the search filter
   */
  export class RemoveSearchFilter {
    static readonly type = '[Features] Remove Search Filter';
    constructor() {}
  }

  /**
   * @description Set feature/s details
   * @param {Feature|Feature[]} features One feature object or array of feature objects to update
   */
  export class SetFeatureInfo {
    static readonly type = '[Features] Set Feature Info';
    constructor(public features: Feature | Feature[]) {}
  }

  /**
   * @description Set feature runs inside details of feature
   * @param {number} feature_id Feature ID
   * @param {FeatureRun[]} runs Array of Runs
   */
  export class SetFeatureRuns {
    static readonly type = '[Features] Set Feature Runs';
    constructor(
      public feature_id: number,
      public runs: FeatureRun[]
    ) {}
  }

  /**
   * @description Allows to modify a property of a feature info
   * @param {number} feature_id Feature ID
   * @param {string} property Key to modify
   * @param {any} value Value to modify
   */
  export class ModifyFeatureInfo {
    static readonly type = '[Features] Modify Feature Info Property';
    constructor(
      public feature_id: number,
      public property: string,
      public value: any
    ) {}
  }

  /**
   * @description Add folder to current route
   * @param {Folder} folder Folder
   */
  export class AddFolderRoute {
    static readonly type = '[Features] Add Folder Route';
    constructor(public folder: Folder) {}
  }

  /**
   * @description Add folder to current route used in the new landing
   * @param {Folder} folder Folder
   */
  export class NewAddFolderRoute {
    static readonly type = '[Features] New Add Folder Route';
    constructor(public folder: Folder) {}
  }

  /**
   * @description Add folder to current route used in the new landing
   * @param {Folder} folder Folder
   */
  export class ReturnToParentRoute {
    static readonly type = '[Folders] Return To Parent Route';
    constructor() {}
  }

  /**
   * @description Set folder to current route
   * @param {Folder} folder Folder
   */
  export class SetFolderRoute {
    static readonly type = '[Features] Set Folder Route';
    constructor(public folder: Folder[]) {}
  }

  /**
   * @description Remove folder of current route
   * @param {number} folderId Folder ID
   */
  export class ReturnToFolderRoute {
    static readonly type = '[Features] ReturnTo Folder Route';
    constructor(public folderId: number) {}
  }

  /**
   * @description Remove folder of current route in the new landing
   * @param {number} folderId Folder ID
   */
  export class newReturnToFolderRoute {
    static readonly type = '[Features] New ReturnTo Folder Route';
    constructor(public folderId: number) {}
  }

  /**
   * @description Set department ids to filter array
   * @param {number[]} department_id Department ID
   */
  export class SetDepartmentFilter {
    static readonly type = '[Features] Set Department Filter';
    constructor(public department_id: number[]) {}
  }

  /**
   * @description Set application ids to filter array
   * @param {number[]} app_id Array of applications IDs
   */
  export class SetApplicationFilter {
    static readonly type = '[Features] Set Application Filter';
    constructor(public app_id: number[]) {}
  }

  /**
   * @description Set environment ids to filter array
   * @param {number[]} environment_id Array of environment IDs
   */
  export class SetEnvironmentFilter {
    static readonly type = '[Features] Set Environment Filter';
    constructor(public environment_id: number[]) {}
  }

  /**
   * @description Makes a request to get Admin Features
   */
  export class GetFeatures {
    static readonly type = '[Features] Get Features';
  }

  /**
   * @description Someone just removed the folder you are watching
   */
  export class FolderGotRemoved {
    static readonly type = '[Features] Folder got removed';
    constructor(public folder_id: number) {}
  }

  /**
   * @description Someone just renamed the folder you are watching
   */
  export class FolderGotRenamed {
    static readonly type = '[Features] Folder got renamed';
    constructor(public folder: Folder) {}
  }
}
