import { Component, OnInit, Inject, ViewChild, ChangeDetectionStrategy, HostListener, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { ApiService } from '@services/api.service';
import { FileUploadService } from '@services/file-upload.service'
import { COMMA, ENTER } from '@angular/cdk/keycodes';
import { API_URL } from 'app/tokens';
import { MatLegacyDialogRef as MatDialogRef, MAT_LEGACY_DIALOG_DATA as MAT_DIALOG_DATA, MatLegacyDialog as MatDialog } from '@angular/material/legacy-dialog';
import { MatLegacySnackBar as MatSnackBar } from '@angular/material/legacy-snack-bar';
import { UntypedFormControl, UntypedFormGroup, Validators, UntypedFormBuilder } from '@angular/forms';
import { MatLegacyCheckboxChange as MatCheckboxChange } from '@angular/material/legacy-checkbox';
import { StepEditorComponent } from '@components/step-editor/step-editor.component';
import { BrowserSelectionComponent } from '@components/browser-selection/browser-selection.component';
import { MatLegacyChipListChange as MatChipListChange } from '@angular/material/legacy-chips';
import { ApplicationsState } from '@store/applications.state';
import { Select, Store } from '@ngxs/store';
import { EnvironmentsState } from '@store/environments.state';
import { ConfigState } from '@store/config.state';
import { UserState } from '@store/user.state';
import { EditVariablesComponent } from '@dialogs/edit-variables/edit-variables.component';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { FeatureCreated } from '@dialogs/edit-feature/feature-created/feature-created.component';
import { ScheduleHelp } from '@dialogs/edit-feature/schedule-help/schedule-help.component';
import { KEY_CODES } from '@others/enums';
import { CustomSelectors } from '@others/custom-selectors';
import { ViewSelectSnapshot } from '@ngxs-labs/select-snapshot';
import { noWhitespaceValidator, deepClone } from 'ngx-amvara-toolbox';
import { StepDefinitions } from '@store/actions/step_definitions.actions';
import { Features } from '@store/actions/features.actions';
import { FeaturesState } from '@store/features.state';
import { finalize, switchMap } from 'rxjs/operators';
import { EmailTemplateHelp } from './email-template-help/email-template-help.component';
import { AreYouSureData, AreYouSureDialog } from '@dialogs/are-you-sure/are-you-sure.component';
import { Configuration } from '@store/actions/config.actions';
import { parseExpression } from 'cron-parser';
import { DepartmentsState } from '@store/departments.state';
import { VariablesState } from '@store/variables.state';

@Component({
  selector: 'edit-feature',
  templateUrl: './edit-feature.component.html',
  styleUrls: ['./edit-feature.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class EditFeature implements OnInit, OnDestroy {
  displayedColumns: string[] = ['name','mime','size','uploaded_by.name','created_on', 'actions'];

  @ViewSelectSnapshot(ConfigState) config$ !: Config;
  /**
   * These values are now filled in the constructor as they need to initialize before the view
  */
  // @ViewSelectSnapshot(ApplicationsState) applications$ !: Application[];
  // @ViewSelectSnapshot(EnvironmentsState) environments$ !: Environment[];
  // @ViewSelectSnapshot(UserState.RetrieveUserDepartments) departments$ !: Department[];
  applications$ !: Application[];
  environments$ !: Environment[];
  departments$ !: Department[];
  @ViewSelectSnapshot(UserState) user !: UserInfo;
  @ViewSelectSnapshot(UserState.HasOneActiveSubscription) hasSubscription: boolean;
  @Select(DepartmentsState) allDepartments$: Observable<Department[]>;
  @Select(VariablesState) variableState$: Observable<VariablePair[]>;


  saving$ = new BehaviorSubject<boolean>(false);

  departmentSettings$: Observable<Department['settings']>
  variable_dialog_isActive: boolean = false;

  steps$: Observable<FeatureStep[]>;

  // next runs an array of next executions
  nextRuns = [];
  // parse error
  parseError = {
	  "error": false,
	  "msg": ""
  }
  // get user timezone
  timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  browserstackBrowsers = new BehaviorSubject<BrowserstackBrowser[]>([]);

  // List of default values to be displayed on the feature information selectors
  selected_department;
  selected_application;
  selected_environment;
  department;
  variables !: VariablePair[];

  readonly separatorKeysCodes: number[] = [ENTER, COMMA];

  @ViewChild(StepEditorComponent, { static: false }) stepEditor: StepEditorComponent;

  // COTEMP -- Used to check the state data status
  @Select(FeaturesState.GetStateDAta) state$: Observable<ReturnType<typeof FeaturesState.GetStateDAta>>;

  featureForm: UntypedFormGroup;

  constructor(
    public dialogRef: MatDialogRef<EditFeature>,
    @Inject(MAT_DIALOG_DATA) public data: IEditFeature,
    private _api: ApiService,
    private _snackBar: MatSnackBar,
    private _store: Store,
    private _dialog: MatDialog,
    private _fb: UntypedFormBuilder,
    private cdr: ChangeDetectorRef,
    private fileUpload: FileUploadService,
    @Inject(API_URL) public api_url: string,
  ) {
    // Create the fields within FeatureForm
    this.featureForm = this._fb.group({
      'app_name': ['', Validators.required],
      'department_name': ['', Validators.required],
      'environment_name': ['', Validators.required],
      'feature_name': ['', Validators.compose([Validators.required, noWhitespaceValidator])],
      'description': [''],
      'schedule': [''],
      'email_address': [[]],
      'email_subject': [''],
      'email_body': [''],
      'address_to_add': [''], // Used only for adding new email addresses
      'depends_on_others': [false],
      'run_now': [false], // Value changed to false so the create testcase dialog will have the schedule checkbox disabled by default
      'send_mail': [false],
      'network_logging': [false],
      'need_help': [false],
      'send_mail_on_error': [false],
      'continue_on_failure': [false],
      'uploaded_files': [[]],
      'video': [true],
      'minute': ['0', Validators.compose([Validators.required, Validators.pattern('^[0-9,-/*]+$')])],
      'hour': ['0', Validators.compose([Validators.required, Validators.pattern('^[0-9,-/*]+$')])],
      'day_month': ['1', Validators.compose([Validators.required, Validators.pattern('^[0-9,-/*]+$')])],
      'month': ['*', Validators.compose([Validators.required, Validators.pattern('^[0-9,-/*]+$')])],
      'day_week': ['*', Validators.compose([Validators.required, Validators.pattern('^[0-9,-/*]+$')])]
    });
    // Gets the currently active route
    let route = this._store.selectSnapshot(FeaturesState.GetCurrentRouteNew);
    // Initialize the departments, applications and environments
    this.departments$ = this._store.selectSnapshot(UserState.RetrieveUserDepartments);
    this.applications$ = this._store.selectSnapshot(ApplicationsState);
    this.environments$ = this._store.selectSnapshot(EnvironmentsState);
    // Initialize the values selected by default on the mat selector
    // Selected the department where the user is currently at or the first available department, only used when creating a new testcase
    this.selected_department = route.length > 0 ? route[0].name : this.departments$[0].department_name;
    this.selected_application = this.applications$[0].app_name;
    this.selected_environment = this.environments$[0].environment_name;

    this.featureForm.valueChanges.subscribe(values => {
      const { minute, hour, day_month, month, day_week } = values;
      this.parseSchedule({ minute, hour, day_month, month, day_week });
    })
  }

  ngOnDestroy() {
    // When Edit Feature Dialog is closed, clear temporal steps
    return this._store.dispatch(new StepDefinitions.ClearNewFeature());
  }

  parseSchedule(expression) {
	// ignore if schedule is disabled
	if (!this.featureForm.value.run_now) return;

	try {
		// parse cron expression
		let parser = parseExpression(Object.values(expression).join(" "), {utc: true});
		// reset errors
		this.parseError.error = false;
		// reset nextRuns arrays
		this.nextRuns = [];
		for(let i = 0; i<5; i++) { this.nextRuns.push(parser.next().toDate().toLocaleString()); }
	} catch (error) {
		this.nextRuns = [];
		this.parseError = {
			"error": true,
			"msg": error.message
		}
	}
  }

  changeSchedule({ checked }: MatCheckboxChange) {
    this.featureForm.get('schedule').setValue(checked ? '' : checked);
    this.featureForm.get('schedule').markAsDirty();
  }

  openScheduleHelp() {
    this._dialog.open(ScheduleHelp, { width: '550px' });
  }

  // Add address to the addresses array
  addAddress(change: MatChipListChange) {
    // Check email value
    if (change.value) {
      // Accounts with only Default department, are limited, they can only use their own email
      if (this.departments$.length === 1 && this.departments$[0].department_name === 'Default' && change.value !== this.user.email) {
        this._snackBar.open('Limited account: You can only add the email assigned to your account', 'OK');
        this.featureForm.get('address_to_add').setValue('');
        return;
      }
      // Get current addresses
      const addresses = this.featureForm.get('email_address').value.concat();
      // Perform push only if address doesn't exist already
      if (!addresses.includes(change.value)) {
        addresses.push(change.value);
        this.featureForm.get('email_address').setValue(addresses);
        this.featureForm.get('email_address').markAsDirty();
      }
      this.featureForm.get('address_to_add').setValue('');
    }
  }

  // Open variables popup, only if a environment is selected (see HTML)
  editVariables() {
    const environmentId = this.environments$.find(env => env.environment_name === this.featureForm.get('environment_name').value).environment_id;
    const departmentId = this.departments$.find(dep => dep.department_name === this.featureForm.get('department_name').value).department_id;
    const feature = this.feature.getValue();

    this.variable_dialog_isActive = true;
    this._dialog.open(EditVariablesComponent, {
      data: {
        feature_id: feature.feature_id,
        environment_id: environmentId,
        department_id: departmentId,
        department_name: this.featureForm.get('department_name').value,
        environment_name: this.featureForm.get('environment_name').value,
        feature_name: this.featureForm.get('feature_name').value
      },
      panelClass: 'edit-variable-panel'
    }).afterClosed().subscribe(res => {
      this.variable_dialog_isActive = false;
    });
  }

  // Remove given address from addresses array
  removeAddress(email: string) {
    if (email) {
      let addresses = this.featureForm.get('email_address').value.concat();
      addresses = addresses.filter(addr => addr !== email);
      this.featureForm.get('email_address').setValue(addresses)
      this.featureForm.get('email_address').markAsDirty();
    }
  }

  handleBrowserChange(browsers) {
    this.browserstackBrowsers.next(browsers);
  }

  // Handle keyboard keys
  @HostListener('document:keydown', ['$event']) handleKeyboardEvent(event: KeyboardEvent) {
    // only execute switch case if child dialog is closed
    if (this.variable_dialog_isActive) return
    switch (event.keyCode) {
      case KEY_CODES.ESCAPE:
        // Check if form has been modified before closing
        if (this.hasChanged()) {
          this._dialog.open(AreYouSureDialog, {
            data: {
              title: 'translate:you_sure.quit_title',
              description: 'translate:you_sure.quit_desc'
            } as AreYouSureData
          }).afterClosed().subscribe(exit => {
            // Close edit feature popup
            if (exit) this.dialogRef.close();
          });
        } else {
          this.dialogRef.close();
        }
        break;
      case KEY_CODES.V:
        if (event.ctrlKey && event.altKey) this.editVariables();
        break;
    }
  }

  // Deeply check if two arrays are equal, in length and values
  arraysEqual(a: any[], b: any[]): boolean {
    if (a === b) return true;
    if (a == null || b == null) return false;
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; ++i) {
      if (a[i] !== b[i]) return false;
    }
    return true;
  }

  /**
   * Check if edit feature form has different values from original object
   */
  hasChanged(): boolean {
    // Retrieve original feature data, when mode is `new` it will only have `feature_id: 0`
    const featureOriginal = this.feature.getValue();
    /**
     * Detect changes in formular
     * Procedure:
     *  1. Check if formular has been modified (dirty)
     *  2. Check if the form field has been modified (dirty)
     *  3. Check if the original feature value is different from the new one
     */
    if (this.featureForm.dirty) {
      // The first selectors needs custom comparison logic
      // Check Department
      const departmentField = this.featureForm.get('department_name');
      if (departmentField.dirty && departmentField.value) {
        const departmentId = this.departments$.find(dep => dep.department_name === departmentField.value).department_id;
        if (this.data.mode === 'new' || featureOriginal.department_id !== departmentId) return true;
      }
      // Check application
      const applicationField = this.featureForm.get('app_name');
      if (applicationField.dirty && applicationField.value) {
        const appId = this.applications$.find(app => app.app_name === applicationField.value).app_id;
        if (this.data.mode === 'new' || featureOriginal.app_id !== appId) return true;
      }
      // Check environment
      const environmentField = this.featureForm.get('environment_name');
      if (environmentField.dirty && environmentField.value) {
        const environmentId = this.environments$.find(env => env.environment_name === environmentField.value).environment_id;
        if (this.data.mode === 'new' || featureOriginal.environment_id !== environmentId) return true;
      }
      // Declare an array of fields with the same key name in original feature and modified
      let fields = ['description', 'depends_on_others', 'send_mail', 'need_help', 'feature_name', 'video', 'continue_on_failure'];
      // Add fields mandatory for Send email
      if (this.featureForm.get('send_mail').value) {
        fields = [ ...fields, 'email_address', 'email_subject', 'email_body', 'send_mail_on_error'];
      }
      // Add fields mandatory for Schedule
      if (this.featureForm.get('run_now').value) {
        fields = [ ...fields, 'minute', 'hour', 'day_month', 'month', 'day_week'];
      }
      // Iterate each field
      for (const key of fields) {
        const field = this.featureForm.get(key);
        // Check if field is changed and has value
        if (field.dirty && field.value) {
          // Custom logic for array values
          if (Array.isArray(field.value)) {
            if (this.data.mode === 'new' || JSON.stringify(field.value) !== JSON.stringify(featureOriginal[key])) {
              return true
            }
          } else {
            if (featureOriginal[key] !== field.value) {
              return true;
            }
          }
        }
      }
    }
    /**
     * Detect changes made outside of formular code
     */
    // Check browsers
    if (JSON.stringify(this.browsersOriginal) !== JSON.stringify(this.browserstackBrowsers.getValue())) return true;
    /**
     * Detect changes in Step Editor
     */
    if (this.stepEditor) {
      const currentSteps = this.stepEditor.getSteps();
      if (this.stepsOriginal.length === currentSteps.length) {
        // Deep compare then
        // Compare step fields
        const fieldsToCompare = ['step_content', 'enabled', 'screenshot', 'compare']
        for (let i = 0; i < currentSteps.length; i++) {
          for (const field of fieldsToCompare) {
            if (currentSteps[i][field] !== this.stepsOriginal[i][field]) {
              return true;
            }
          }
        }
      } else {
        return true;
      }
    }
    return false;
  }

  @ViewChild(BrowserSelectionComponent, { static: false }) _browserSelection: BrowserSelectionComponent;

  ngOnInit() {
    this.featureForm.valueChanges.subscribe(() => {
      this.variableState$.subscribe(data =>  {
        this.variables =  this.getFilteredVariables(data)
      })
    })

    if (this.data.mode === 'edit' || this.data.mode === 'clone') {
      // Code for editing feautre
      const featureInfo = this.data.info;
      // Initialize the selected by default application, department and environment
      this.selected_application = featureInfo.app_name;
      this.selected_department = featureInfo.department_name;
      this.selected_environment = featureInfo.environment_name;
      this.feature.next(featureInfo);
      // Assign observable of department settings
      this.departmentSettings$ = this._store.select(CustomSelectors.GetDepartmentSettings(featureInfo.department_id));
      this.browserstackBrowsers.next(featureInfo.browsers);
      this.browsersOriginal = deepClone(featureInfo.browsers);
      this.featureForm.get('run_now').setValue(featureInfo.schedule !== '');
      if (featureInfo.schedule) {
        const cron_fields = ['minute', 'hour', 'day_month', 'month', 'day_week'];
        const cron_values = featureInfo.schedule.split(' ');
        for (let i = 0; i < cron_fields.length; i++) {
          this.featureForm.get(cron_fields[i]).setValue(cron_values[i]);
        }
      }
      // Try to save all possible feature properties in the form using the same property names
      for (const key in featureInfo) {
        if (this.featureForm.get(key) instanceof UntypedFormControl) {
          this.featureForm.get(key).setValue(featureInfo[key]);
        }
      }
      this.stepsOriginal = this.data.steps;
    } else {
      // Code for creating a feature
      // set user preselect options
      this.feature.next(this.data.feature);
      this.preSelectedOptions()
    }
    // @ts-ignore
    if (!this.feature) this.feature = { feature_id: 0 };
    const featureId = this.data.mode === 'clone' ? 0 : this.data.feature.feature_id;
    this.steps$ = this._store.select(CustomSelectors.GetFeatureSteps(featureId))

    this.featureForm.get('department_name').valueChanges.subscribe(department_name => {
      this.allDepartments$.subscribe(data => {
        this.department = data.find(dep => dep.department_name === department_name);
        this.fileUpload.validateFileUploadStatus(this.department);
        this.cdr.detectChanges();
      })
    })
  }

  /**
   * Select user specified selections if any.
   */
  preSelectedOptions() {
    const { 
      preselectDepartment,
      preselectApplication,
      preselectEnvironment,
      recordVideo } = this.user.settings;
    
    this.departments$.find(d => {
      if (d.department_id == preselectDepartment) this.selected_department = d.department_name;
    })
    this.applications$.find(a => { 
      if (a.app_id == preselectApplication) this.selected_application = a.app_name;
    })
    this.environments$.find(e => { 
      if (e.environment_id == preselectEnvironment) this.selected_environment = e.environment_name
    })
    this.featureForm.patchValue({
      video: recordVideo != undefined ? recordVideo : true
      // ... add addition properties here.
    })
  }

  stepsOriginal: FeatureStep[] = [];
  browsersOriginal: BrowserstackBrowser[] = [];

  feature = new BehaviorSubject<Feature>(null);

  /**
   * Auto focus to the given form control
   * @param name Name of the control
   */
  focusFormControl(name: string) {
    try {
      // Get form control element
      const element = document.querySelector(`[formcontrolname="${name}"]`) as HTMLElement;
      // Scroll element into user view
      element.scrollIntoView({
        block: 'center',
        behavior: 'smooth'
      });
      // Auto focus to it
      element.focus();
    } catch (err) {
      console.log(`Couldn\'t focus on ${name} control.`);
    }
  }

  openEmailHelp() {
    this._dialog.open(EmailTemplateHelp);
  }

  /**
   * Open are you sure dialog and wait for response
   */
  async openAreYouSureDialog(): Promise<boolean> {
    const dialogRef = this._dialog.open(AreYouSureDialog, {
      data: {
        title: `Save ${this.featureForm.get('feature_name').value}`,
        description: 'Are you sure you want to save this feature? One or more steps contain errors.'
      } as AreYouSureData
    })
    
    return dialogRef.afterClosed().toPromise().then(answer => {
      return Promise.resolve(answer);
    });
  }

  /**
   * Creates a new feature or edits an existing one. It executes whenever the user clicks on the create / save button in the feature dialog
   * @returns
   */
  async editOrCreate() {
    // Get current steps from Store
    let currentSteps = [];
    if (this.stepEditor) {
      // Check if StepEditor exists
      currentSteps = this.stepEditor.getSteps();
      if (this.stepEditor.stepsForm) {
        // Check steps validity
        if (!this.stepEditor.stepsForm.valid) {
          const result = await this.openAreYouSureDialog()
          if (!result) {
            // Focus on on first invalid step
            try {
              document.querySelector<HTMLTextAreaElement>('.invalid-step textarea').focus();
            } catch (err) { console.log('Failed to focus on step input') }
            return;
          }
          /**
           OLD LOGIC - Before 2021-12-30
          this._snackBar.open('One or more steps are invalid, fix them before saving.', 'OK', { duration: 5000 });
          // Focus on on first invalid step
          try {
            document.querySelector<HTMLTextAreaElement>('.invalid-step textarea').focus();
          } catch (err) { console.log('Failed to focus on step input') }
          return;
          */
        }
      }
    } else {
      // If StepEditor doesn't exist grab steps from Store
      // @ts-ignore
      if (!this.feature) this.feature = { feature_id: 0 };
      const featureId = this.data.mode === 'clone' ? 0 : this.data.feature.feature_id;
      currentSteps = this._store.selectSnapshot(CustomSelectors.GetFeatureSteps(featureId))
    }
    const steps = {
      // Remove empty steps
      steps_content: currentSteps.filter(step => !!step.step_content),
      screenshots: [],
      compares: []
    };
    // Create screenshots and compares arrays from current steps
    steps.steps_content.filter(step => step.enabled).forEach((item, index) => {
      if (item.screenshot) steps.screenshots.push(index + 1);
      if (item.compare) steps.compares.push(index + 1);
    });
    const incompletePrefix = 'Feature info is incomplete';
    // Get current selectors information ids
    let departmentId, appId, environmentId;
    // Check Department ID
    try {
      departmentId = this.departments$.find(dep => dep.department_name === this.featureForm.get('department_name').value).department_id;
    } catch (err) {
      this.focusFormControl('department_name');
      this._snackBar.open(`${incompletePrefix}: missing department`);
      return;
    }
    // Check App ID
    try {
      appId = this.applications$.find(app => app.app_name === this.featureForm.get('app_name').value).app_id;
    } catch (err) {
      this.focusFormControl('app_name');
      this._snackBar.open(`${incompletePrefix}: missing application`);
      return;
    }
    // Check Environment ID
    try {
      environmentId = this.environments$.find(env => env.environment_name === this.featureForm.get('environment_name').value).environment_id;
    } catch (err) {
      this.focusFormControl('environment_name');
      this._snackBar.open(`${incompletePrefix}: missing environment`);
      return;
    }
    // Check Feature Name
    if (!this.featureForm.get('feature_name').valid) {
      this.focusFormControl('feature_name');
      this._snackBar.open(`${incompletePrefix}: missing name`);
      return;
    }
    const fValues = this.featureForm.value;
    // Create FormData for sending XHR
    const dataToSend = {
      ...this.featureForm.value,
      steps: steps,
      environment_id: environmentId,
      app_id: appId,
      department_id: departmentId,
      browsers: this.browserstackBrowsers.getValue()
    };
    // Construct schedule for sending
    if (fValues.run_now) {
      dataToSend.schedule = [fValues.minute, fValues.hour, fValues.day_month, fValues.month, fValues.day_week].join(' ');
    } else {
      dataToSend.schedule = '';
    }

    // --------------------------------------------
    // Save XHR
    // ... now dataToSend has been prepared and we can send it to Backend
    // ... Different for save & clone and create
    // ... create dialog asks if you want to run it now
    // ... data.mode can be 'new', 'clone', 'edit'
    // -------------------------------------------------
    // Special code for when editing or clonning feature
    // -------------------------------------------------
    dataToSend.feature_id = this.data.feature.feature_id;
    dataToSend.cloud = this.feature.getValue().cloud;
    if (this._browserSelection) {
      dataToSend.cloud = this._browserSelection.testing_cloud.value;
    }
    if (this.data.mode === 'clone' || this.data.mode === 'new') {
      dataToSend.feature_id = 0;
    }
    this.saving$.next(true);
    this._api.patchFeature(dataToSend.feature_id, dataToSend, {
      loading: 'translate:tooltips.saving_feature'
    }).pipe(
      finalize(() => this.saving$.next(false))
    ).subscribe(res => {
      // res.info contains the feature data
      // res.success contains true or false

      // After sending the XHR we have received the result in "res"
      // Checking for success and not
      // .... show snackBar
      // .... move feature to folder, if necesarry
      // .... show dialog according to new or clone & save/edit
      if (res.success) {
        // If XHR was ok
        this._snackBar.open('Feature saved.', 'OK');
        this._store.dispatch( new Features.UpdateFeatureOffline(res.info) )
        // Toggles the welcome to false, meaning that the user is no longer new in co.meta
        this.toggleWelcome();
        this.manageFeatureDialogData(res, dataToSend);
      } else {
        // If XHR was ok
        this._snackBar.open('An error ocurred.', 'OK');
      }
    });
  }

  /**
   * Decides what to do with the data after clicking submit on the feature edit dialog: clone, create or edit feature
   * @param res
   * @param dataToSend
   * @author dph000
   * @date 2021/10/25
   */
  manageFeatureDialogData(res, dataToSend) {
    // Move to current folder
    if (this.data.mode === 'clone' || this.data.mode === 'new') {
      this.moveFeatureToCurrentFolder(res.info.feature_id).subscribe();
      this._store.dispatch( new Features.GetFolders() );
    }

    // dialog when saving or cloning
    if (this.data.mode === 'edit' || this.data.mode === 'clone') {
      // dialog for clone and save
      this.dialogRef.close(dataToSend);
    } else {
      // dialog when creating offering option to run report
      if (res.info.feature_id) {
        this._dialog.open(FeatureCreated, {
          minWidth: '500px',
          data: {
            feature_name: dataToSend.feature_name,
            feature_id: res.info.feature_id,
            app_name: dataToSend.app_name,
            environment_name: dataToSend.environment_name,
            department_name: dataToSend.department_name,
            description: dataToSend.description
          }
        });
        this.dialogRef.close(dataToSend);
      }
    }
  }

  /**
   * Checks if the current user is inside a folder and moves
   * the just created/cloned feature inside it
   * @param {number} featureId Feature ID
   */
  moveFeatureToCurrentFolder(featureId: number): Observable<any> {
    // Get current folder route
    const currentRoute = this._store.selectSnapshot(FeaturesState.GetSelectionFolders).filter(route => route.type != 'department');
    // Check if changing folder of created feature is necessary
    if (currentRoute.length > 0) {
      // Get current folder id
      const folderId = currentRoute[currentRoute.length - 1].folder_id;
      // Move feature in backend
      return this._api.moveFeatureFolder(null, folderId, featureId).pipe(
        switchMap(res => {
          if (res.success) {
            // Update folders in front
            return this._store.dispatch( new Features.GetFolders );
          }
          // Check errors
          if (!res.success && !res.handled) {
            this._snackBar.open('An error ocurred while moving feature to folder.', 'OK');
          }
          return of({});
        })
      )
    } else {
      return of({});
    }
  }

  checkboxChange = ({ checked }: MatCheckboxChange, key: string) => {
    this.featureForm.get(key).setValue(checked);
    this.featureForm.get(key).markAsDirty();
  }

  /**
   * Toggle the co_first_time_cometa local storage variable, meaning that the user has already created a testcase
   * @returns new Configuration of co_first_time_cometa
   * @author dph000
   * @date 21/11/02
   * @lastModification 21/11/02
   */
   toggleWelcome(){
     return this._store.dispatch(new Configuration.SetProperty('co_first_time_cometa', 'false', true));
   }

  // adds each selected file into formControl array
  onUploadFile(ev) {
    let formData: FormData = new FormData;
    let files = ev.target.files

    for (let file of files) {
      formData.append("files", file)
    }
    formData.append("department_id", this.department.department_id);

    this.fileUpload.startUpload(files, formData, this.department, this.user);
  }

  onDownloadFile(file: UploadedFile) {
    // return if file is still uploading
    if(file.status.toLocaleLowerCase() != 'done') {
      return;
    }

    const downloading = this._snackBar.open('Generating file to download, please be patient.', 'OK', { duration: 10000 })

    this.fileUpload.downloadFile(file.id).subscribe({
      next: (res) => {
        const blob = new Blob([this.base64ToArrayBuffer(res.body)], { type: file.mime });
        this.fileUpload.downloadFileBlob(blob, file);
        downloading.dismiss();
      },
      error: (err) => {
        if (err.error) {
          const errors = JSON.parse(err.error);
          this._snackBar.open(errors.error, 'OK');
        }
      }
    })
  }

  base64ToArrayBuffer(data: string) {
    const byteArray = atob(data);
    const uint = new Uint8Array(byteArray.length)
    for (let i = 0; i < byteArray.length; i++) {
        let ascii = byteArray.charCodeAt(i);
        uint[i] = ascii;
    }
    return uint;
  }

  onDeleteFile(file: UploadedFile) {
    this.fileUpload.deleteFile(file.id).subscribe(res => {
      if (res.success) this.fileUpload.updateFileState(file, this.department);
    });
  }

  onRestoreFile(file: UploadedFile) {
    let formData: FormData = new FormData;
    formData.append("restore", String(file.is_removed) );

    this.fileUpload.restoreFile(file.id, formData).subscribe(res => {
      if (res.success) this.fileUpload.updateFileState(file, this.department);
    });
  }

  public onFilePathCopy(successful: boolean): void {
    const duration = 2000;
    successful ? this._snackBar.open("File upload path has been copied", "OK", { duration: duration }) :
                 this._snackBar.open("File upload path could not be copied", "OK", { duration: duration })
  }


  getFilteredVariables(variables: VariablePair[]) {
    const environmentId = this.environments$.find(env => env.environment_name === this.featureForm.get('environment_name').value)?.environment_id;
    const departmentId = this.departments$.find(dep => dep.department_name === this.featureForm.get('department_name').value)?.department_id;

    let feature = this.feature.getValue();
    let reduced = variables.reduce((filtered_variables: VariablePair[], current:VariablePair) => {
      // stores variables, if it's id coincides with received department id and it is based on department
      const byDeptOnly = current.department === departmentId && current.based == 'department' ? current : null;

      // stores variable if department id coincides with received department id and
      // environment or feature ids coincide with received ones, additionally if feature id coincides variable must be based on feature. If environment id coincides, variables must be based on environment.
      const byEnv = current.department === departmentId && ((current.environment === environmentId && current.based == 'environment') ||
                                                            (current.feature === feature.feature_id && current.based == 'feature')) ? current : null;

      // pushes stored variables into array if they have value
      byDeptOnly ? filtered_variables.push(byDeptOnly) : null;
      byEnv ? filtered_variables.push(byEnv) : null;

      // removes duplicated variables and returs set like array
      return filtered_variables.filter((value, index, self) => index === self.findIndex((v) => (v.id === value.id)))
    }, [])
    return reduced;
  }
}