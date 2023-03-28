import { Injectable, Inject } from '@angular/core';
import { HttpClient, HttpResponse } from '@angular/common/http';
import { API_URL, API_BASE } from 'app/tokens';
import { Observable, of } from 'rxjs';
import { filter, map, switchMap } from 'rxjs/operators';
import { encodeURLParams } from 'ngx-amvara-toolbox';
import { InterceptorParams } from 'ngx-network-error';
import { MatDialog } from '@angular/material/dialog';
import { AreYouSureData, AreYouSureDialog } from '@dialogs/are-you-sure/are-you-sure.component';

@Injectable()
export class ApiService {

  constructor(
    private _http: HttpClient,
    private _dialog: MatDialog,
    @Inject(API_URL) public api: string,
    @Inject(API_BASE) public base: string
  ) {  }

  /**
   * @description Save favourite browsers on the Backend for the current logged user
   * @author Alex Barba
   * @usedIn UserState
   */
  saveBrowserFavourites(user: UserInfo, browsers: BrowserstackBrowser[]): Observable<boolean> {
    return this._http.patch<any>(`${this.api}accounts/${user.user_id}/`, {
      email: user.email,
      permission_name: user.user_permissions.permission_name,
      name: user.name,
      favourite_browsers: JSON.stringify(browsers)
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
      settings: settings
    });
  }

  doOIDCLogin = () => this._http.get<UserInfo>(`${this.base}addoidcaccount/${window.location.search}`);

  // Get Folders of features
  getFolders = () => this._http.get<FoldersResponse>(`${this.api}folders/`);

  // Create Folder on the backend for the current logged user and inside another folder
  createFolder(name: string, department_id: number, parent_id: number = 0) {
    const params = {
      name: name,
      department: department_id
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
  moveFeatureFolder(previous_id: number | string, next_id: number, feature_id: number, department_id?: number) {
    const params = {
      feature_id: feature_id
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
    return this._http.get<Log>(`${this.base}feature_results/${feature_result_id}/log`);
  }

  // Get HTML Difference
  getHTMLDiff(step_result_id: number) {
    return this._http.get<DiffResponse>(`${this.base}html_diff/${step_result_id}/`);
  }

  // Get FeatureResult info
  getFeatureResult(feature_result_id: number) {
    return this._http.get<any>(`${this.api}feature_results/${feature_result_id}/`).pipe(
      map(json => json.result as FeatureResult)
    );
  }

  // Get Feature Runs
  getFeatureRuns(feature_id: number) {
    return this._http.get<PaginatedResponse<FeatureRun>>(`${this.api}feature_results/?feature_id=${feature_id}`).pipe(
      map(res => res.results)
    );
  }

  // Remove step result screenshot file
  removeScreenshot(step_result_id: number, type: ScreenshotType) {
    return this._http.post<Success>(`${this.base}removeScreenshot/`, {
      step_result_id: step_result_id,
      type: type
    });
  }

  // Remove step result template file
  removeTemplate(step_result_id: number, file: string) {
    return this._http.post<Success>(`${this.base}removeTemplate/`, {
      step_result_id: step_result_id,
      template: file
    });
  }

  getFeature(FeatureID: number, params?) {
    return this._http.get<PaginatedResponse<Feature>>(`${this.api}features/${FeatureID}/`, { params: params }).pipe(
      map(res => res.results.find(feature => feature.feature_id === FeatureID))
    );
  }

  // Get all step specifying a ID or Name
  getFeatureSteps(feature_id: number, params?) {
    return this._http.get<PaginatedResponse<FeatureStep>>(`${this.base}steps/${feature_id}/`, { params: params }).pipe(
      map(res => res.results)
    )
  }

  /**
   * Retrieves the requested step result object by ID
   * in a Success response type
   * @param {number} step_result_id Step Result ID
   * @returns Observable<StepResult>
   */
  getStepResult(step_result_id: number) {
    return this._http.get<Success>(`${this.api}step_result/${step_result_id}/`).pipe(
      map(res => res.results)
    )
  }

  /**
   * Performs any property/s modification for the given StepResult
   * @param step_result_id StepResult ID
   * @param patches Partial object of StepResult
   */
  patchStepResult(step_result_id: number, patches: Partial<StepResult>) {
    return this._http.patch<Success>(`${this.api}step_result/${step_result_id}/`, patches);
  }

  /**
   * Performs any property/s modification for the given FeatureResult
   * @param featureResultId Feature result id
   * @param archive Partial object of FeatureResult
   */
  patchFeatureResult(featureResultId: number, patches: Partial<FeatureResult>, params?) {
    return this._http.patch<Success>(`${this.api}feature_results/${featureResultId}/`, patches, {
      params: params
    });
  }

  /**
   * Performs any property/s modification for the given FeatureRun
   * @param runId Feature run id
   * @param archive Partial object of FeatureRun
   */
  patchRun(runId: number, patches: Partial<FeatureRun>, params?) {
    return this._http.patch<Success>(`${this.api}feature_run/${runId}/`, patches, {
      params: params
    });
  }

  // Get available steps with a department and application
  getAvailableActions(department: string = 'DIF', app: string = 'amvara') {
    const params = '?' + encodeURLParams({ department: department, app: app });
    return this._http.get<PaginatedResponse<Action>>(`${this.api}actions/${params}`).pipe(
      map(res => res.results)
    );
  }

  // Get Environment
  getEnvironments() {
    return this._http.get<PaginatedResponse<Environment>>(`${this.api}environments/`);
  }

  // Get features
  getFeatures() {
    return this._http.get<PaginatedResponse<Feature>>(`${this.api}features/`).pipe(
      map(json => {
        if (json.results && json.results[0] && json.results[0].browsers === null) {
          json.results[0].browsers = [];
        }
        return json;
      })
    );
  }

  // Create feature and run
  createFeature(query: SendFeature, params?) {
    return this._http.post<Feature>(`${this.api}features/`, query, {
      params: params
    });
  }

  /**
   * Allows to modify properties of a feature object
   * @param {number} featureId Feature ID
   * @param {Partial<Feature>} patches Partial object of Feature modified
   * @returns Observable<EditFeatureResponse>
   */
  patchFeature(featureId: number, patches: Partial<Feature>, params?) {
    return this._http.patch<EditFeatureResponse>(`${this.api}features/`, {
      feature_id: featureId,
      ...patches
    }, {
      params: params
    })
  }

  /**
   * Allows to modify properties of a feature object including the folder
   * @param {number} featureId Feature ID, Previous Folder Id, Next Folder Id
   * @param {Partial<Feature>} patches Partial object of Feature modified
   * @returns Observable<EditFeatureResponse>
   */
   patchFeatureV2(featureId: number, patches: Partial<Feature>, previous_id: number | string, next_id: number, department_id?: number) {
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
    return this._http.get<PaginatedResponse<Application>>(`${this.api}applications/`);
  }

  // Get browsers
  getBrowsers() {
    return this._http.get<BrowserResultObject[]>(`${this.api}browsers/`);
  }

  // Get all departments (Admin)
  getDepartments() {
    return this._http.get<PaginatedResponse<Department>>(`${this.api}departments/`);
  }

  // Run a feature just now
  runFeature(feature_id: number, shouldWait: boolean) {
    return this._http.post<Success>(`${this.base}exectest/`, {
      feature_id: feature_id,
      wait: shouldWait || false
    }).pipe(
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
              dialog = this._dialog.open(AreYouSureDialog, {
                data: {
                  title: 'translate:you_sure.budget_exceeded_title',
                  description: 'translate:you_sure.budget_exceeded_desc'
                } as AreYouSureData
              }).afterClosed()
              break;
            case 'confirm_ahead':
              // Show confirm dialog
              dialog = this._dialog.open(AreYouSureDialog, {
                data: {
                  title: 'translate:you_sure.budget_ahead_title',
                  description: 'translate:you_sure.budget_ahead_desc'
                } as AreYouSureData
              }).afterClosed()
              break;
            default:
              dialog = of(false)
          }
          return dialog.pipe(
            // Only repeat XHR if user confirms
            filter(answer => !!answer),
            // Repeat exectest with confirm: true
            switchMap(_ => this._http.post<Success>(`${this.base}exectest/`, {
              feature_id: feature_id,
              wait: shouldWait || false,
              confirm: true
            }))
          )
        }
      })
    )
  }

  getInvoices() {
    return this._http.get<UsageInvoice[]>(`${this.base}invoices/`);
  }

  getInvoiceUrl(invoiceId: number) {
    return this._http.get<Success>(`${this.base}invoices/${invoiceId}/`)
  }

  deleteFeature(feature_id: number, params?) {
    return this._http.delete<Success>(`${this.api}features/${feature_id}/`, {
      params: params
    });
  }

  // Departments

  createDepartment(department_name) {
    return this._http.post<any>(`${this.api}departments/`, {
      department_name: department_name
    });
  }

  modifyDepartment(department_id: number, newOptions: Partial<Department>) {
    return this._http.patch<Success>(`${this.api}departments/${department_id}/`, newOptions);
  }

  deleteDepartment(department_id: number) {
    return this._http.delete<Success>(`${this.api}departments/${department_id}/`);
  }

  // Applications

  createApplication(app_name) {
    return this._http.post<any>(`${this.api}applications/`, {
      app_name: app_name
    });
  }

  renameApplication(app_id: number, app_name: string) {
    return this._http.patch<Success>(`${this.api}applications/${app_id}/${app_name}/`, {});
  }

  deleteApplication(app_id: number) {
    return this._http.delete<Success>(`${this.api}applications/${app_id}/`, {});
  }

  // Browsers

  createBrowser(browser_name) {
    return this._http.post<any>(`${this.api}browsers/`, {
      browser_name: browser_name
    });
  }

  renameBrowser(browser_id: number, browser_name: string) {
    return this._http.patch<Success>(`${this.api}browsers/${browser_id}/${browser_name}/`, {});
  }

  deleteBrowser(browser_id: number) {
    return this._http.delete<Success>(`${this.api}browsers/${browser_id}/`, {});
  }

  // Environments

  createEnvironment(environment_name) {
    return this._http.post<any>(`${this.api}environments/`, {
      environment_name: environment_name
    });
  }

  renameEnvironment(environment_id: number, environment_name: string) {
    return this._http.patch<Success>(`${this.api}environments/${environment_id}/${environment_name}/`, {});
  }

  deleteEnvironment(environment_id: number) {
    return this._http.delete<Success>(`${this.api}environments/${environment_id}/`, {});
  }

  // Accounts

  getAccounts() {
    return this._http.get<PaginatedResponse<IAccount>>(`${this.api}accounts/`).pipe(
      map(json => json.results)
    );
  }

  modifyAccount(UserID: number, userInfo: IAccount) {
    return this._http.patch<Success>(`${this.api}accounts/${UserID}/`, userInfo);
  }

  deleteAccount(UserID: number) {
    return this._http.delete<Success>(`${this.api}accounts/${UserID}/`);
  }

  modifyPassword(UserID: number, password: string) {
    return this._http.patch<Success>(`${this.api}accounts/${UserID}/password/`, {
      password: btoa(unescape(encodeURIComponent(password)))
    });
  }

  updateSchedule(FeatureID: number, schedule: string) {
    return this._http.patch<Success>(`${this.base}schedule/${FeatureID}/`, {
      schedule: schedule
    });
  }

  getBrowserstackBrowsers() {
    return this._http.get<BrowserstackBrowsersResponse>(`${this.base}browsers/browserstack`);
  }

  removeFeatureResult(feature_result_id, deleteTemplate: boolean = false, params?) {
    return this._http.delete<Success>(`${this.api}feature_results/${feature_result_id}/${deleteTemplate ? '?delete_template' : ''}`, {
      params: params
    });
  }

  removeFeatureRun(run_id, deleteTemplate: boolean = false, params?) {
    return this._http.delete<Success>(`${this.api}feature_run/${run_id}/${deleteTemplate ? '?delete_template' : ''}`, {
      params: params
    });
  }

  removeMultipleFeatureRuns(featureId: number, type: ClearRunsType, deleteTemplate: boolean = false) {
    return this._http.delete<Success>(`${this.api}feature_run/`, {
      params: {
        ...(deleteTemplate && { delete_template: ''}),
        feature_id: featureId.toString(),
        type: type
      }
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
    return this._http.post<Success>(`${this.api}variables/`, variable);
  }

  patchVariable(variable: VariablePair) {
    return this._http.patch<Success>(`${this.api}variables/${variable.id}/`, variable);
  }


  sendInvite(emails: string[], departmentIds: number, customText: string) {
    return this._http.post<Success>(`${this.api}invite/`, {
      emails: emails,
      departments: departmentIds,
      custom_text: customText
    })
  }

  /**
   * API Endpoint to get variables
   */
  getVariables() {
    return this._http.get<VariablePair[]>(`${this.api}variables/`)
  }

  // Manage encryption

  encrypt(text) {
    return this._http.post<any>(`${this.base}encrypt/`, {
      action: 'encrypt',
      text: text
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
    return this._http.get<PaginatedResponse<Integration>>(`${this.api}integrations/`).pipe(
      map(json => json.results)
    )
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
    return this._http.post(`${this.base}checkBrowserstackVideo/`, {
      video: videoUrl
    }, {
      observe: 'response',
      responseType: 'text'
    })
  }

  generateCustomerPortal() {
    return this._http.get<Success>(`${this.base}customerPortal/`);
  }

  getUserDetails() {
    return this._http.get<UserDetails>(`${this.base}userDetails/`)
  }

  isFeatureRunning(featureId: number) {
    return this._http.get<any>(`${this.base}isFeatureRunning/${featureId}/`).pipe(
      map(response => response.running)
    );
  }

  checkVideoAvailable(videoUrl: string): Observable<HttpResponse<any>> {
    return this._http.get(videoUrl, {
      headers: {
        // Fetch only the first 1024 bytes
        // This avoids having to download the entire video file
        Range: 'bytes=0-1024'
      },
      observe: 'response',
      responseType: 'text',
      // Ignore interceptors and caches
      params: new InterceptorParams({
        skipInterceptor: true,
        ignoreDiskCache: true,
        ignoreProxyCache: true,
        ignoreServiceWorkerCache: true
      })
    })
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

  downloadFile(file_id: number) {
    return this._http.get(`${this.api}uploads/${file_id}/`, {
      params: new InterceptorParams({
        skipInterceptor: true,
      }),
      responseType: 'text',
      observe: 'response'
    });
  }
}
