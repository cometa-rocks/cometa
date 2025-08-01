import { Injectable, Inject } from '@angular/core';
import { HttpClient, HttpResponse } from '@angular/common/http';
import { API_URL, API_BASE } from 'app/tokens';
import { Observable, of } from 'rxjs';
import { filter, map, switchMap } from 'rxjs/operators';
import { encodeURLParams } from 'ngx-amvara-toolbox';
import { InterceptorParams } from 'ngx-network-error';
import { MatLegacyDialog as MatDialog } from '@angular/material/legacy-dialog';
import {
  AreYouSureData,
  AreYouSureDialog,
} from '@dialogs/are-you-sure/are-you-sure.component';

@Injectable()
export class ApiService {
  constructor(
    private _http: HttpClient,
    private _dialog: MatDialog,
    @Inject(API_URL) public api: string,
    @Inject(API_BASE) public base: string
  ) {}

  /**
   * @description Save favourite browsers on the Backend for the current logged user
   * @author Alex Barba 
   * @usedIn UserState
   */
  saveBrowserFavourites(
    user: UserInfo,
    browsers: BrowserstackBrowser[]
  ): Observable<boolean> {
    return this._http.patch<any>(`${this.api}accounts/${user.user_id}/`, {
      email: user.email,
      permission_name: user.user_permissions.permission_name,
      name: user.name,
      favourite_browsers: JSON.stringify(browsers),
    });
  }

  /**
   * @description Save settings on the Backend for the current logged user
   * @author Alex Barba
   * @usedIn tour.service.ts
   * @returns Observable<HttpRequest>
   */
  saveUserSettings(user: UserInfo, settings: any) {
    return this._http.patch<Success>(`${this.api}accounts/${user.user_id}/`, {
      email: user.email,
      name: user.name,
      settings: settings,
    });
  }

  doOIDCLogin = () =>
    this._http.get<UserInfo>(
      `${this.base}addoidcaccount/${window.location.search}`
    );

  // Get Folders of features
  getFolders = () => this._http.get<FoldersResponse>(`${this.api}folders/`);
  getTreeView = () =>
    this._http.get<FoldersResponse>(`${this.api}folders/?tree`);

  // Create Folder on the backend for the current logged user and inside another folder
  createFolder(name: string, department_id: number, parent_id: number = 0) {
    const params = {
      name: name,
      department: department_id,
    } as any;
    if (parent_id !== 0 && parent_id !== null) {
      params.parent_id = parent_id;
    }
    return this._http.post<Success>(`${this.api}folders/`, params);
  }

  // Rename Folder on the backend for the current logged user
  modifyFolder(folder: Partial<Folder>) {
    return this._http.patch<Folder>(`${this.api}folders/`, folder);
  }

  // Create Folder on the backend for the current logged user and inside another folder
  removeFolder(folder_id: number) {
    return this._http.delete<Success>(`${this.api}folders/${folder_id}/remove`);
  }

  // Move feature folder on the backend for the current logged user
  moveFeatureFolder(
    previous_id: number | string,
    next_id: number,
    feature_id: number,
    department_id?: number
  ) {
    const params = {
      feature_id: feature_id,
    } as any;
    if (previous_id !== 0) {
      params.old_folder = previous_id;
    }
    if (next_id !== 0) {
      params.new_folder = next_id;
    }
    if (department_id) {
      // Add the department_id variable to send it to the backend
      params.department_id = department_id;
    }
    return this._http.patch<Success>(`${this.api}folder/feature/`, params);
  }

  // Get Log Output
  getLogOutput(feature_result_id: number) {
    return this._http.get<Log>(
      `${this.base}feature_results/${feature_result_id}/log`
    );
  }

  // Get HTML Difference
  getHTMLDiff(step_result_id: number) {
    return this._http.get<DiffResponse>(
      `${this.base}html_diff/${step_result_id}/`
    );
  }

  // Get FeatureResult info
  getFeatureResult(feature_result_id: number) {
    return this._http
      .get<any>(`${this.api}feature_results/${feature_result_id}/`)
      .pipe(map(json => json.result as FeatureResult));
  }

  // Get Feature Runs
  getFeatureRuns(feature_id: number) {
    return this._http
      .get<
        PaginatedResponse<FeatureRun>
      >(`${this.api}feature_results/?feature_id=${feature_id}`)
      .pipe(map(res => res.results));
  }

  // Remove step result screenshot file
  removeScreenshot(step_result_id: number, type: ScreenshotType) {
    return this._http.post<Success>(`${this.base}removeScreenshot/`, {
      step_result_id: step_result_id,
      type: type,
    });
  }

  // Remove step result template file
  removeTemplate(step_result_id: number, file: string) {
    return this._http.post<Success>(`${this.base}removeTemplate/`, {
      step_result_id: step_result_id,
      template: file,
    });
  }

  getFeature(FeatureID: number, params?) {
    return this._http
      .get<
        PaginatedResponse<Feature>
      >(`${this.api}features/${FeatureID}/`, { params: params })
      .pipe(
        map(res =>
          res.results.find(feature => feature.feature_id === FeatureID)
        )
      );
  }

  // Get all step specifying a ID or Name
  getFeatureSteps(feature_id: number, params?) {
    return this._http
      .get<
        PaginatedResponse<FeatureStep>
      >(`${this.base}steps/${feature_id}/`, { params: params })
      .pipe(map(res => res.results));
  }

  // Get REST API call
  getRestAPI(id: number) {
    return this._http
      .get<Success>(`${this.api}rest_api/${id}/`)
      .pipe(map(res => res.result));
  }

  // Parse JQ, if content is a rest api id
  getParsedJQFilter(filter: string, rest_id: number) {
    return this._http.post<Success>(
      `${this.base}compile_jq/`,
      {
        pattern: filter,
        rest_api: rest_id,
      },
      {
        params: new InterceptorParams({
          skipInterceptor: true,
          silent: true,
        }),
      }
    );
  }


    // Parse JQ, if content is a json or string
    getParsedJQFilter_content(filter: string, content: any) {
      return this._http.post<Success>(
        `${this.base}compile_jq/`,
        {
          pattern: filter,
          content: content,
        },
        {
          params: new InterceptorParams({
            skipInterceptor: true,
            silent: true,
          }),
        }
      );
    }

  /**
   * Retrieves the requested step result object by ID
   * in a Success response type
   * @param {number} step_result_id Step Result ID
   * @returns Observable<StepResult>
   */
  getStepResult(step_result_id: number) {
    return this._http
      .get<Success>(`${this.api}step_result/${step_result_id}/`)
      .pipe(map(res => res.results));
  }

  /**
   * Performs any property/s modification for the given StepResult
   * @param step_result_id StepResult ID
   * @param patches Partial object of StepResult
   */
  patchStepResult(step_result_id: number, patches: Partial<StepResult>) {
    return this._http.patch<Success>(
      `${this.api}step_result/${step_result_id}/`,
      patches
    );
  }

  /**
   * Performs any property/s modification for the given FeatureResult
   * @param featureResultId Feature result id
   * @param archive Partial object of FeatureResult
   */
  patchFeatureResult(
    featureResultId: number,
    patches: Partial<FeatureResult>,
    params?
  ) {
    return this._http.patch<Success>(
      `${this.api}feature_results/${featureResultId}/`,
      patches,
      {
        params: params,
      }
    );
  }

  /**
   * Performs any property/s modification for the given FeatureRun
   * @param runId Feature run id
   * @param archive Partial object of FeatureRun
   */
  patchRun(runId: number, patches: Partial<FeatureRun>, params?) {
    return this._http.patch<Success>(
      `${this.api}feature_run/${runId}/`,
      patches,
      {
        params: params,
      }
    );
  }

  // Get available steps with a department and application
  getAvailableActions(department: string = 'DIF', app: string = 'amvara') {
    const params = '?' + encodeURLParams({ department: department, app: app });
    return this._http
      .get<PaginatedResponse<Action>>(`${this.api}actions/${params}`)
      .pipe(map(res => res.results));
  }

  // Get Environment
  getEnvironments() {
    return this._http.get<PaginatedResponse<Environment>>(
      `${this.api}environments/`
    );
  }

  // Get features
  getFeatures() {
    return this._http
      .get<PaginatedResponse<Feature>>(`${this.api}features/`)
      .pipe(
        map(json => {
          if (
            json.results &&
            json.results[0] &&
            json.results[0].browsers === null
          ) {
            json.results[0].browsers = [];
          }
          return json;
        })
      );
  }

  // Create feature and run
  createFeature(query: SendFeature, params?) {
    return this._http.post<Feature>(`${this.api}features/`, query, {
      params: params,
    });
  }

  /**
   * Allows to modify properties of a feature object
   * @param {number} featureId Feature ID
   * @param {Partial<Feature>} patches Partial object of Feature modified
   * @returns Observable<EditFeatureResponse>
   */
  patchFeature(featureId: number, patches: Partial<Feature>, params?) {
    return this._http.patch<EditFeatureResponse>(
      `${this.api}features/`,
      {
        feature_id: featureId,
        ...patches,
      },
      {
        params: params,
      }
    );
  }

  /**
   * Allows to modify properties of a feature object including the folder
   * @param {number} featureId Feature ID, Previous Folder Id, Next Folder Id
   * @param {Partial<Feature>} patches Partial object of Feature modified
   * @returns Observable<EditFeatureResponse>
   */
  patchFeatureV2(
    featureId: number,
    patches: Partial<Feature>,
    previous_id: number | string,
    next_id: number,
    department_id?: number
  ) {
    // Move the testcase to the specified folder, changing the department if necessary
    return this.moveFeatureFolder(
      previous_id,
      next_id,
      featureId,
      department_id
    );
  }

  // Get applications
  getApplications() {
    return this._http.get<PaginatedResponse<Application>>(
      `${this.api}applications/`
    );
  }

  // Get browsers
  getBrowsers() {
    return this._http.get<BrowserResultObject[]>(`${this.api}browsers/`);
  }

  // Get all departments (Admin)
  getDepartments() {
    return this._http.get<PaginatedResponse<Department>>(
      `${this.api}departments/`
    );
  }

  // Run a feature just now
  runFeature(feature_id: number, shouldWait: boolean) {
    return this._http
      .post<Success>(`${this.base}exectest/`, {
        feature_id: feature_id,
        wait: shouldWait || false,
      })
      .pipe(
        switchMap(response => {
          if (response.success) {
            // Execution went OK
            return of(response);
          }
          if (response.action) {
            // Execution of a feature requires an action
            let dialog: Observable<boolean>;
            switch (response.action) {
              case 'confirm_exceeded':
                // Show confirm dialog
                dialog = this._dialog
                  .open(AreYouSureDialog, {
                    data: {
                      title: 'translate:you_sure.budget_exceeded_title',
                      description: 'translate:you_sure.budget_exceeded_desc',
                    } as AreYouSureData,
                    autoFocus: true,
                  })
                  .afterClosed();
                break;
              case 'confirm_ahead':
                // Show confirm dialog
                dialog = this._dialog
                  .open(AreYouSureDialog, {
                    data: {
                      title: 'translate:you_sure.budget_ahead_title',
                      description: 'translate:you_sure.budget_ahead_desc',
                    } as AreYouSureData,
                    autoFocus: true,
                  })
                  .afterClosed();
                break;
              default:
                dialog = of(false);
            }
            return dialog.pipe(
              // Only repeat XHR if user confirms
              filter(answer => !!answer),
              // Repeat exectest with confirm: true
              switchMap(_ =>
                this._http.post<Success>(`${this.base}exectest/`, {
                  feature_id: feature_id,
                  wait: shouldWait || false,
                  confirm: true,
                })
              )
            );
          }
        })
      );
  }

  getInvoices() {
    return this._http.get<UsageInvoice[]>(`${this.base}invoices/`);
  }

  getInvoiceUrl(invoiceId: number) {
    return this._http.get<Success>(`${this.base}invoices/${invoiceId}/`);
  }

  deleteFeature(feature_id: number, params?) {
    return this._http.delete<Success>(`${this.api}features/${feature_id}/`, {
      params: params,
    });
  }

  // Departments

  createDepartment(department_name) {
    return this._http.post<any>(`${this.api}departments/`, {
      department_name: department_name,
    });
  }

  applyDepartmentStepsTimeout(
    department_id: number,
    options: { step_timeout_from: number; step_timeout_to: number }
  ) {
    return this._http.post<any>(
      `${this.base}departments/${department_id}/updateStepTimeout/`,
      options,
      {
        params: new InterceptorParams({
          skipInterceptor: true,
        }),
      }
    );
  }

  modifyDepartment(department_id: number, newOptions: Partial<Department>) {
    return this._http.patch<Success>(
      `${this.api}departments/${department_id}/`,
      newOptions
    );
  }

  deleteDepartment(department_id: number) {
    return this._http.delete<Success>(
      `${this.api}departments/${department_id}/`
    );
  }

  // Applications

  createApplication(app_name) {
    return this._http.post<any>(`${this.api}applications/`, {
      app_name: app_name,
    });
  }

  renameApplication(app_id: number, app_name: string) {
    return this._http.patch<Success>(
      `${this.api}applications/${app_id}/${app_name}/`,
      {}
    );
  }

  deleteApplication(app_id: number) {
    return this._http.delete<Success>(`${this.api}applications/${app_id}/`, {});
  }

  // Browsers

  createBrowser(browser_name) {
    return this._http.post<any>(`${this.api}browsers/`, {
      browser_name: browser_name,
    });
  }

  renameBrowser(browser_id: number, browser_name: string) {
    return this._http.patch<Success>(
      `${this.api}browsers/${browser_id}/${browser_name}/`,
      {}
    );
  }

  deleteBrowser(browser_id: number) {
    return this._http.delete<Success>(`${this.api}browsers/${browser_id}/`, {});
  }

  // Environments

  createEnvironment(environment_name) {
    return this._http.post<any>(`${this.api}environments/`, {
      environment_name: environment_name,
    });
  }

  renameEnvironment(environment_id: number, environment_name: string) {
    return this._http.patch<Success>(
      `${this.api}environments/${environment_id}/${environment_name}/`,
      {}
    );
  }

  deleteEnvironment(environment_id: number) {
    return this._http.delete<Success>(
      `${this.api}environments/${environment_id}/`,
      {}
    );
  }

  // Accounts

  getAccounts() {
    return this._http
      .get<PaginatedResponse<IAccount>>(`${this.api}accounts/`)
      .pipe(map(json => json.results));
  }

  modifyAccount(UserID: number, userInfo: IAccount) {
    return this._http.patch<Success>(
      `${this.api}accounts/${UserID}/`,
      userInfo
    );
  }

  deleteAccount(UserID: number) {
    return this._http.delete<Success>(`${this.api}accounts/${UserID}/`);
  }

  modifyPassword(UserID: number, password: string) {
    return this._http.patch<Success>(
      `${this.api}accounts/${UserID}/password/`,
      {
        password: btoa(unescape(encodeURIComponent(password))),
      }
    );
  }

  updateSchedule(FeatureID: number, schedule: string) {
    return this._http.patch<Success>(`${this.base}schedule/${FeatureID}/`, {
      schedule: schedule,
    });
  }

  /**
   * Validate cron expression using backend CronSlices library
   * @param cronExpression The cron expression to validate  
   * @returns Observable with validation result
   */
  validateCron(cronExpression: string) {
    return this._http.post<{success: boolean, valid: boolean, cron_expression: string, error?: string}>(`${this.base}validateCron/`, {
      cron_expression: cronExpression,
    });
  }

  getLyridBrowsers() {
    return this._http.get<BrowserstackBrowsersResponse>(
      `${this.base}browsers/lyrid`
    );
  }

  getBrowserstackBrowsers() {
    return this._http.get<BrowserstackBrowsersResponse>(
      `${this.base}browsers/browserstack`
    );
  }

  removeFeatureResult(
    feature_result_id,
    deleteTemplate: boolean = false,
    params?
  ) {
    return this._http.delete<Success>(
      `${this.api}feature_results/${feature_result_id}/${deleteTemplate ? '?delete_template' : ''}`,
      {
        params: params,
      }
    );
  }

  removeFeatureRun(run_id, deleteTemplate: boolean = false, params?) {
    return this._http.delete<Success>(
      `${this.api}feature_run/${run_id}/${deleteTemplate ? '?delete_template' : ''}`,
      {
        params: params,
      }
    );
  }

  removeMultipleFeatureRuns(
    featureId: number,
    type: ClearRunsType,
    deleteTemplate: boolean = false
  ) {
    return this._http.delete<Success>(`${this.api}feature_run/`, {
      params: {
        ...(deleteTemplate && { delete_template: '' }),
        feature_id: featureId.toString(),
        type: type,
      },
    });
  }

  stopRunningTask(feature_id) {
    return this._http.get<Success>(`${this.base}killTask/${feature_id}/`);
  }

  // Get feature info as JSON
  getJsonFeatureFile(feature_id: number) {
    return this._http.get<any>(`${this.base}getJson/${feature_id}/`);
  }

  // Manage Environment Variables

  /**
   * API Endpoint to create an environment variable for a given environment and department
   * @param environment ID of existing environment
   * @param department ID of existing department
   * @param values Variables
   */
  setVariable(variable: VariablePair) {
    return this._http.post<Success>(`${this.api}variables/`, variable, {
      params: new InterceptorParams({
        skipInterceptor: true,
      }),
    });
  }

  patchVariable(variable: VariablePair) {
    return this._http.patch<Success>(
      `${this.api}variables/${variable.id}/`,
      variable,
      {
        params: new InterceptorParams({
          skipInterceptor: true,
        }),
      }
    );
  }

  deleteVariable(id: number) {
    return this._http.delete<Success>(`${this.api}variables/${id}`, {
      params: new InterceptorParams({
        skipInterceptor: true,
      }),
    });
  }

  sendInvite(emails: string[], departmentIds: number, customText: string) {
    return this._http.post<Success>(`${this.api}invite/`, {
      emails: emails,
      departments: departmentIds,
      custom_text: customText,
    });
  }

  /**
   * API Endpoint to get variables
   */
  getVariables() {
    return this._http.get<VariablePair[]>(`${this.api}variables/`);
  }

  // Manage encryption

  encrypt(text) {
    return this._http.post<any>(`${this.base}encrypt/`, {
      action: 'encrypt',
      text: text,
    });
  }

  /* decrypt(text): Observable<any> {
    return this._http.post<any>(`${this.base}encrypt/`, {
      action: 'decrypt',
      text: text
    }).pipe(
      map(json => json.result)
    );
  } */

  getServerInfo() {
    return this._http.get<any>(`${this.base}info/`);
  }

  getIntegrations() {
    return this._http
      .get<PaginatedResponse<Integration>>(`${this.api}integrations/`)
      .pipe(map(json => json.results));
  }

  createIntegration(params: IntegrationPayload) {
    return this._http.post<Integration>(`${this.api}integrations/`, params);
  }

  patchIntegration(id: number, params: IntegrationPayload) {
    return this._http.patch<Success>(`${this.api}integrations/${id}/`, params);
  }

  deleteIntegration(id: number) {
    return this._http.delete<Success>(`${this.api}integrations/${id}/`);
  }

  checkBrowserstackVideo(videoUrl: string): Observable<HttpResponse<any>> {
    return this._http.post(
      `${this.base}checkBrowserstackVideo/`,
      {
        video: videoUrl,
      },
      {
        observe: 'response',
        responseType: 'text',
      }
    );
  }

  generateCustomerPortal() {
    return this._http.get<Success>(`${this.base}customerPortal/`);
  }

  getUserDetails() {
    return this._http.get<UserDetails>(`${this.base}userDetails/`);
  }

  isFeatureRunning(featureId: number) {
    return this._http
      .get<any>(`${this.base}isFeatureRunning/${featureId}/`)
      .pipe(map(response => response.running));
  }

  checkVideoAvailable(videoUrl: string): Observable<HttpResponse<any>> {
    return this._http.get(videoUrl, {
      headers: {
        // Fetch only the first 1024 bytes
        // This avoids having to download the entire video file
        Range: 'bytes=0-1024',
      },
      observe: 'response',
      responseType: 'text',
      // Ignore interceptors and caches
      params: new InterceptorParams({
        skipInterceptor: true,
        ignoreDiskCache: true,
        ignoreProxyCache: true,
        ignoreServiceWorkerCache: true,
      }),
    });
  }

  uploadFiles(formData: FormData) {
    return this._http.post<any>(`${this.api}uploads/`, formData);
  }

  updateFile(file_id: number, formdata: FormData) {
    return this._http.put<any>(`${this.api}uploads/${file_id}/`, formdata);
  }

  deleteFile(file_id: number) {
    return this._http.delete<any>(`${this.api}uploads/${file_id}/`);
  }

  deleteDataDrivenTest(run_id: number) {
    return this._http.delete<any>(`${this.api}data_driven/${run_id}/`);
  }

  stopDataDrivenTest(run_id: number) {
    return this._http.post<{ success: boolean; tasks: number; run_id: number }>(`${this.base}stop_data_driven/${run_id}`, {});
  }

  /**
   * Updates the data in a data-driven file
   * @param fileId The ID of the file to update
   * @param dataOrRequest Either the updated data rows array (legacy) or an object with data and column_order
   * @param params Optional parameters, including sheet name for Excel files
   * @returns An observable with the response from the server
   */
  updateDataDrivenFile(fileId: number, dataOrRequest: any[] | {data: any[], column_order?: string[]}, params?: any) {
    // Create base params with skipInterceptor
    const apiParams = new InterceptorParams({
      skipInterceptor: true,
    });
    
    // Build the URL with query parameters if necessary
    let url = `${this.api}data_driven/file/${fileId}/`;
    
    // If sheet parameter is provided, add it to the URL
    if (params && params.sheet) {
      url += `?sheet=${encodeURIComponent(params.sheet)}`;
      
      // Add any other params except 'sheet' to apiParams
      Object.keys(params).forEach(key => {
        if (key !== 'sheet') {
          apiParams.set(key, params[key]);
        }
      });
    } else {
      // Merge all params if no sheet parameter
      if (params) {
        Object.keys(params).forEach(key => {
          apiParams.set(key, params[key]);
        });
      }
    }
    
    // Determine the request body format
    let requestBody: any;
    if (Array.isArray(dataOrRequest)) {
      // Legacy format: just the data array
      requestBody = { data: dataOrRequest };
    } else {
      // New format: object with data and optional column_order
      requestBody = dataOrRequest;
    }
    
    return this._http.put<any>(
      url,
      requestBody,
      {
        params: apiParams
      }
    );
  }

  downloadFile(file_id: number) {
    return this._http.get(`${this.api}uploads/${file_id}/`, {
      params: new InterceptorParams({
        skipInterceptor: true,
      }),
      responseType: 'text',
      observe: 'response',
    });
  }


  getHouseKeepingLogs(): Observable<HouseKeepingLogs[]> {
    return this._http
      .get<{ housekeepinglogs: HouseKeepingLogs[] }>(`${this.api}housekeeping/`)
      .pipe(map(response => response.housekeepinglogs));
  }

  getHouseKeepingLog(id:Number) {
    return this._http .get<HouseKeepingLogs>(`${this.api}housekeeping/${id}`);
  }

  getCometaConfigurations(): Observable<Configuration[]> {
    return this._http
      .get<{ results: Configuration[] }>(`${this.api}configuration/`)
      .pipe(map(response => response.results));
  }

  getStandByBrowsers(): Observable<Configuration[]> {
    return this._http
      .get<{ results: Configuration[] }>(`${this.api}configuration/`)
      .pipe(map(response => response.results));
  }

  updateConfigurations(body) {
    return this._http.post<any>(`${this.api}configuration/`,body);
  }


  setConfigurations(configuration: Configuration): Observable<Configuration> {
    return this._http.post<string>(`${this.api}configuration/`, configuration, {
      params: new InterceptorParams({
        skipInterceptor: true,
      }),
    }).pipe(
      map(response => JSON.parse(response) as Configuration)
    );
  }

  patchConfigurations(configuration: Configuration): Observable<Configuration> {
    return this._http.patch<string>(
      `${this.api}configuration/${configuration.id}/`,
      configuration,
      {
        params: new InterceptorParams({
          skipInterceptor: true,
        }),
      }
    ).pipe(
      map(response => JSON.parse(response) as Configuration)
    );
  }

  deleteConfigurations(id: number): Observable<Success> {
    return this._http.delete<Success>(`${this.api}configuration/${id}/`, {
      params: new InterceptorParams({
        skipInterceptor: true,
      })
    });
  }


  /**
   * Get the mobile emulators list
   * @returns Observable<IMobile>
   */
  getMobileList() {
    return this._http.get<{ mobiles: IMobile[] }>(`${this.api}mobile/`).pipe(
      map(response => response.mobiles) // Extract only the `results` field
    );
  }

  /**
   * Get the mobile emulators list
   * @returns Observable<IMobile>
   */
  getContainersList() {
    return this._http.get<{ containerservices: Container[] }>(`${this.api}container_service/`).pipe(
      map(response => response.containerservices) // Extract only the `results` field
    );
  }

  /**
   * Start the mobile emulators the mobile available mobiles list
   * @returns Observable<IMobile>
   */
  startMobile(body) {
    return this._http.post<Container>(`${this.api}container_service/`, body)
  }

 /**
 * Terminates a running mobile emulator by its container ID.
 * @param {string} container_id - The ID of the container to be terminated.
 * @returns Observable<void> - An observable that completes when the delete request is successful.
 */
  terminateMobile(container_id) {
    return this._http.delete(`${this.api}container_service/${container_id}/`);
  }

  /**
   * Updates the properties of a mobile emulator identified by its container ID.
   * @param {string} container_id - The ID of the container to be updated.
   * @param {any} body - The request payload containing the updated properties for the mobile emulator.
   * @returns Observable<EditFeatureResponse> - An observable containing the response from the update request.
   */
  updateMobile(container_id, body) {
    return this._http.put(`${this.api}container_service/${container_id}/`, body);
  }


  getContainerServices() {
    return this._http.get(`${this.api}container_service/`);
  }

  deleteContainerServices(id:number) {
    return this._http.delete(`${this.api}container_service/${id}/`);
  }

  startContainerServices(body:any) {
    return this._http.post(`${this.api}container_service/`,body);
  }

  runHouseKeeping() {
    return this._http.delete(`${this.api}housekeeping/`);
  }

  /**
   * Get the existing schedule for a data-driven file.
   */
  getFileSchedule(fileId: number) {
    return this._http.get<{ success: boolean; schedule: string; original_cron: string | null; original_timezone: string | null }>(`${this.base}schedule_data_driven/${fileId}/`);
  }

  /**
   * Get schedule data for multiple files at once
   */
  getBulkFileSchedules(fileIds: number[]) {
    return this._http.post<{
      success: boolean;
      schedules: { [fileId: number]: { schedule: string; original_cron: string | null; original_timezone: string | null } };
      error?: string;
    }>(`${this.base}bulk_file_schedules/`, { file_ids: fileIds });
  }

  /**
   * Update or create a schedule entry for a data-driven file.
   * NOTE: Backend endpoint `schedule_data_driven` must exist.
   */
  updateFileSchedule(fileId: number, payload: { schedule: string; original_timezone?: string | null }) {
    return this._http.patch<{success: boolean}>(`${this.base}schedule_data_driven/${fileId}/`, payload);
  }

  /**
   * Get the currently running feature for a data-driven test run.
   * Used for real-time LiveSteps tracking in DDT mode.
   */
  getDDTCurrentlyRunningFeature(runId: number) {
    return this._http.get<{
      success: boolean;
      current_feature: {
        feature_id: number;
        feature_name: string;
        feature_result_id: number;
        current_step: string;
        running: boolean;
        date_time: string | null;
      } | null;
      ddt_info?: {
        run_id: number;
        file_name: string;
        total_features: number;
        status: string;
      };
      status?: string;
      message?: string;
    }>(`${this.base}data_driven/${runId}/current_feature/`);
  }

  /**
   * Get all features and their status for a DDT run.
   * Used for LiveSteps component in data-driven mode.
   */
  getDDTAllFeatures(runId: number) {
    return this._http.get<{
      success: boolean;
      features: Array<{
        feature_id: number;
        feature_name: string;
        feature_result_id: number;
        status: 'queued' | 'running' | 'completed' | 'failed';
        current_step: string | null;
        running: boolean;
        success: boolean;
        date_time: string | null;
        execution_time: number;
      }>;
      ddt_info: {
        run_id: number;
        file_name: string;
        status: string;
        running: boolean;
        total: number;
        ok: number;
        fails: number;
        skipped: number;
        execution_time: number;
      };
    }>(`${this.base}data_driven/${runId}/all_features/`);
  }

  /**
   * Fetch description and example for a mobile step from backend
   * @param step The step pattern for which to retrieve documentation
   */
  getMobileStepDoc(step: string): Observable<{ description: string; example: string }> {
    return this._http
      .get<{ success: boolean; description: string; example: string }>(
        `${this.api}mobile_step_doc/`,
        { params: { step } }
      )
      .pipe(
        map(res => ({ description: res.description, example: res.example }))
      );
  }


}
