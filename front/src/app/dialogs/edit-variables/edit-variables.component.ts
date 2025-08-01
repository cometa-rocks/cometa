import {
  Component,
  Inject,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  OnInit,
  ViewChild,
  OnDestroy,
  ElementRef,
  HostListener,
} from '@angular/core';
import {
  MatLegacyDialog as MatDialog,
  MAT_LEGACY_DIALOG_DATA as MAT_DIALOG_DATA,
  MatLegacyDialogModule,
} from '@angular/material/legacy-dialog';
import { Select, Store } from '@ngxs/store';
import { ApiService } from '@services/api.service';
import { MatLegacySnackBar as MatSnackBar } from '@angular/material/legacy-snack-bar';
import { UserState } from '@store/user.state';
import { map,  Observable, Subject, takeUntil } from 'rxjs';
import { VariablesState } from '@store/variables.state';
import { Variables } from '@store/actions/variables.actions';
import { ViewSelectSnapshot } from '@ngxs-labs/select-snapshot';
import {
  AreYouSureData,
  AreYouSureDialog,
} from '@dialogs/are-you-sure/are-you-sure.component';
import { MatSort, Sort, MatSortModule } from '@angular/material/sort';
import {
  MatLegacyTableDataSource as MatTableDataSource,
  MatLegacyTableModule,
} from '@angular/material/legacy-table';
import {
  MatLegacyCheckboxChange as MatCheckboxChange,
  MatLegacyCheckboxModule,
} from '@angular/material/legacy-checkbox';
import { AmDateFormatPipe } from '@pipes/am-date-format.pipe';
import { AmParsePipe } from '@pipes/am-parse.pipe';
import { MatLegacyTooltipModule } from '@angular/material/legacy-tooltip';
import { MatLegacyOptionModule } from '@angular/material/legacy-core';
import { MatLegacySelectModule } from '@angular/material/legacy-select';
import { MatLegacyMenuModule } from '@angular/material/legacy-menu';
import { MatLegacyButtonModule } from '@angular/material/legacy-button';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';
import { MatLegacyInputModule } from '@angular/material/legacy-input';
import { MatIconModule } from '@angular/material/icon';
import { MatLegacyFormFieldModule } from '@angular/material/legacy-form-field';
import { CdkDrag, CdkDragHandle } from '@angular/cdk/drag-drop';
import { NgIf, NgFor } from '@angular/common';
import { InputFocusService } from '@services/inputFocus.service'; 
import { DraggableWindowModule } from '@modules/draggable-window.module';
import { CustomSelectors } from '@others/custom-selectors';
import { Features } from '@store/actions/features.actions';
import { KEY_CODES } from '@others/enums';

interface PassedData {
  environment_id: number;
  department_id: number;
  feature_id: number;
  department_name: string;
  environment_name: string;
  feature_name: string;
}

@Component({
  selector: 'edit-variables',
  templateUrl: './edit-variables.component.html',
  styleUrls: ['./edit-variables.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [
    NgIf,
    MatLegacyDialogModule,
    CdkDrag,
    CdkDragHandle,
    MatLegacyFormFieldModule,
    MatIconModule,
    MatLegacyInputModule,
    ReactiveFormsModule,
    FormsModule,
    MatLegacyButtonModule,
    MatLegacyMenuModule,
    NgFor,
    MatLegacyCheckboxModule,
    MatLegacyTableModule,
    MatSortModule,
    MatLegacySelectModule,
    MatLegacyOptionModule,
    MatLegacyTooltipModule,
    AmParsePipe,
    AmDateFormatPipe,
    DraggableWindowModule
  ],
})
export class EditVariablesComponent implements OnInit, OnDestroy {
  allColumns: VariableColumns[] = [
    { name: 'Name', activated: true, value: 'variable_name' },
    { name: 'Value', activated: true, value: 'variable_value' },
    { name: 'Encrypted', activated: true, value: 'encrypted' },
    { name: 'Based on', activated: true, value: 'based' },
    { name: 'Department', activated: true, value: 'department_name' },
    { name: 'Environment', activated: true, value: 'environment_name' },
    { name: 'Feature', activated: true, value: 'feature_name' },
    { name: 'Created by', activated: false, value: 'created_by_name' },
    { name: 'Last updated by', activated: false, value: 'updated_by_name' },
    { name: 'Created on', activated: false, value: 'created_on' },
    { name: 'Last updated on', activated: false, value: 'updated_on' },
    { name: 'Actions', activated: true, value: 'actions' },
  ];

  displayedColumns: string[] = [];
  bases: string[] = ['feature', 'environment', 'department'];
  isEditing: boolean = false;
  errors = { name: null, value: null };
  variables: VariablePair[];
  variable_backup: VariablePair;
  destroy$ = new Subject<void>();
  searchTerm: string = '';
  isDialog: boolean = false;
  dataSource;
  departmentChecked = false;
  featureChecked = false;
  depAndFeatChecked: boolean = false;
  features$: Observable<any[]>;
  allFeatures: any[] = []
  selectionsDisabled: boolean = false;
  selectedDepartment: { id: number, name: string } = { 
    id: null, 
    name: '' 
  };

  selectedFeature: { id: number, name: string,  id_enviornment: number, name_environment: string  } = { 
    id: null, 
    name: '',
    id_enviornment: null, 
    name_environment: '',
  };

  defaultBasedValue: string = 'department';

  @ViewChild('tableWrapper') tableWrapper: ElementRef;
  @ViewChild(MatSort) sort: MatSort;
  @Select(VariablesState) variableState$: Observable<VariablePair[]>;
  @ViewSelectSnapshot(UserState.GetPermission('create_variable'))
  canCreate: boolean;
  @ViewSelectSnapshot(UserState.GetPermission('edit_variable'))
  canEdit: boolean;
  @ViewSelectSnapshot(UserState.GetPermission('delete_variable'))
  canDelete: boolean;
  departments$: Observable<Folder[]>
  departments: Folder[] = [];

  constructor(
    @Inject(MAT_DIALOG_DATA) public data: PassedData,
    private _store: Store,
    private _snack: MatSnackBar,
    private _api: ApiService,
    private _cdr: ChangeDetectorRef,
    private _dialog: MatDialog,
    private inputFocusService: InputFocusService
  ) {}

  sendInputFocusToParent(inputFocus: boolean): void {
    this.inputFocusService.setInputFocus(inputFocus);
  }

  ngOnInit(): void {
    // get displayed columns from localstorage
    const storedColumns = JSON.parse(
      localStorage.getItem('co_edit_variable_displayed_columns')
    );

    // Load default based value from localStorage
    const storedBased = localStorage.getItem('co_edit_variable_default_based');
    if (storedBased) {
      this.defaultBasedValue = storedBased;
    }

    // if result is not null, load columns from localstorage, else load default columns
    storedColumns != null
      ? this.loadStoredColumns(storedColumns)
      : this.onColumnDisplayChange();

    // department_id is received only when component is opened as dialog
    this.isDialog = this.data?.department_id ? true : false;

    this.variableState$.pipe(takeUntil(this.destroy$)).subscribe(data => {
      this.variables = this.isDialog
        ? this.getFilteredVariables(data)
        : this.getAllVariables(data);
      this.dataSource = new MatTableDataSource(this.variables);

      this.departments$ = this._store.select(CustomSelectors.GetDepartmentFolders())

      this.departments$.pipe(takeUntil(this.destroy$)).subscribe(departments => {
        this.departments = departments;
      });

      // Inbuilt MatTableDataSource.filterPredicate determines which columns filter term must be applied to
      this.applyFilterPredicate();

      // apply current searchTerm
      this.applyFilter();
    });
    this.restoreSortState();
  }

  ngOnDestroy(): void {
    // destroy subscription
    this.destroy$.next();
    this.destroy$.complete();

    // when this dialog is closed, remove any variable with id 0 from variable state.
    this.variables.forEach(variable => {
      if (variable.id === 0) {
        this._store.dispatch(new Variables.DeleteVariable(variable.id));
      }
    });
  }

  // loads colums received from localstorage if length of the array has items. If array is loads default columns
  loadStoredColumns(storedColumns: string[]) {
    if (storedColumns.length > 0) {
      this.allColumns.map(
        item => (item.activated = storedColumns.includes(item.value))
      );
      this.onColumnDisplayChange();
      return;
    }

    this.onColumnDisplayChange();
  }

  // removes or adds clicked column from displayed columns
  onColumnDisplayChange() {
    this.displayedColumns = this.allColumns
      .filter(item => item.activated)
      .map(item => item.value);

    localStorage.setItem(
      'co_edit_variable_displayed_columns',
      JSON.stringify(this.displayedColumns)
    );
  }

  onEditVar(variable: VariablePair) {
    // if user is currently editing some variable row and double click is performed on different variable row, give feedback message and return
    // this snack feedback message will only be provided if user tries to edit variable with double click mouse event, while another variable is being edited.
    if (this.isEditing && variable.disabled) {
      this._snack.open(
        'Please save changes in order to edit another variable.',
        'OK'
      );
      return;
    }

    // return if user double clicks on a row that she/he is already editing
    if (this.isEditing && !variable.disabled) {
      return;
    }

    // save backup of current state of variable in case user wants to cancel changes
    this.variable_backup = { ...variable };

    // notify view that currently there is a variable that is being edited and enable table row that variable is located at.
    this.isEditing = true;
    variable.disabled = false;

    // focus enabled row
    this.focusElement(`name-${variable.id}`);
  }

  onSaveVar(variable: VariablePair) {
    // If input validators are invalid, return
    // this condition will only be fired when user tries to save variable with ENTER keyboard event
    if (this.errors.name || this.errors.value) {
      return;
    }

    // removes from state variable with id 0 (if it exists)
    this._store.dispatch(new Variables.DeleteVariable(0));

    // Depending on if user is creating new variable or is patching existing one
    // next piece of code updates existing variable in state or replaces the removed variable(with id 0) with the one that is received from XHR
    let action =
      variable.id === 0 
        ? this.createVariable(variable)
        : this.patchVariable(variable);
    action.subscribe(this.safeSubscriber('save'));
  }

  onDeleteVar(variable: VariablePair) {
    // defines action to be realized, in this case > Delete
    let action = this.deleteVariable(variable.id);

    // opens confirmation dialog, to prevent accidental elimination
    const confirmDialog = this._dialog.open(AreYouSureDialog, {
      data: { 
        title: 'translate:you_sure.delete_item_title',
        description: 'translate:you_sure.delete_item_desc',
      } as AreYouSureData,
      autoFocus: true,
    });

    // if dialogs result is 'yes/true', removes variable completes action to eliminate variable
    confirmDialog.afterClosed().subscribe(res => {
      if (res) {
        action.subscribe(this.safeSubscriber('delete', variable));
        return;
      }
    });
  }

  onEncryptCheckboxChange(event: MatCheckboxChange, variable: VariablePair) {
    if (!event.checked && variable.variable_value.startsWith('U2FsdGVkX1')) {
      // opens confirmation dialog, to prevent accidental elimination of encrypted variable value
      const confirmDialog = this._dialog.open(AreYouSureDialog, {
        data: {
          title: 'translate:you_sure.decrypt_title',
          description: 'translate:you_sure.decrypt_desc',
        } as AreYouSureData,
        autoFocus: true,
      });

      // if dialogs result is 'yes/true', resets the value of variable. But it is still not saved, user can revert it by hitting ESC key or Cancel button
      confirmDialog.afterClosed().subscribe(res => {
        if (res) {
          variable.variable_value = '';
          this.setInputStatus({ required: true }, 'value');
          this._cdr.markForCheck();

          // focus enabled row's variable-value input
          this.focusElement(`value-${variable.id}`);
          return;
        }

        // if dialog result is no/false. go back to previous state of value encryption and focus variable-name input
        variable.encrypted = true;
        this.focusElement(`name-${variable.id}`);
        this._cdr.markForCheck();
      });
    }
  }

  onCancelVar(variable: VariablePair, event: Event) {
    // stop propagation if user cancels modification by clicking ESC key, this will prevent whole popup from closing
    if (event) event.stopImmediatePropagation();

    // if users is cancelling the process of creation of new variable, dispaches delete event to remove it from state
    // if user is cancelling the process of modification of already existing variable, dispatches update event to set variable to its previous state
    variable.id === 0
      ? this._store.dispatch(new Variables.DeleteVariable(variable.id))
      : this._store.dispatch(
          new Variables.UpdateOrCreateVariable(this.variable_backup)
        );
    this.variable_backup = null;

    // Nulify validatrs for newly created variables
    this.nullifyValidators();

    // notify view that user is no longer editing any variable
    this.isEditing = false;

    // Enable selectdepartment and selectfeature
    this.selectionsDisabled = false;
    this.departmentChecked = false;
  }

  // fired when user clicks on Add Variable button
  onAddVar() {
    // creates and dispatches new temporary variable object to state, so it gets rendered in view
    this.createNewVarInstance();
    this.applyValidators();
    this.isEditing = true;

    // scrolls up to top and focus new variable row
    setTimeout(() => {
      this.tableWrapper.nativeElement.scrollTo(0, 0);
      document.getElementById('name-0').focus();
    }, 0);
  }

  // is fired when, sorting of any column on table is changed
  announceSortChange(sortState: Sort) {
    localStorage.setItem('Variable_Sort_State', JSON.stringify(sortState));
    this.dataSource.sort = this.sort;
  }
  
  restoreSortState() {
    const sortState = JSON.parse(localStorage.getItem('Variable_Sort_State'));
    if (sortState && this.sort) {
      this.sort.active = sortState.active;
      this.sort.direction = sortState.direction;
      this.dataSource.sort = this.sort;
    }
  }

  // Receives string from search input and adds it to dataSource as filterTerm.
  applyFilter() {
    this.dataSource.filter = this.searchTerm.trim().toLowerCase();
  }

  // determines which columns filter must be applied to
  applyFilterPredicate() {
    this.dataSource.filterPredicate = (row: VariablePair, filter: string) => {
      // Always show new rows (id = 0)
      if (row.id === 0) {
        return true;
      }
      return (
        row.variable_name.toLocaleLowerCase().includes(filter) ||
        row.based.toLocaleLowerCase().includes(filter) ||
        row.department_name.toLocaleLowerCase().includes(filter)
      );
    };
  }

  // binded to (input) event. Actualizes input's validator status every time user focuses out of input
  setInputStatus(errors: any, control: string) {
    this.errors[control] = errors;
  }

  // create variable XHR
  createVariable(variable: VariablePair) {
    return this._api.setVariable(variable);
  }

  // update variable XHR
  patchVariable(variable: VariablePair) {
    return this._api.patchVariable(variable);
  }

  // delete variable XHR
  deleteVariable(id: number) {
    return this._api.deleteVariable(id);
  }

  // set validators for newly created temporary variables
  applyValidators() {
    this.errors = { name: { required: true }, value: { required: true } };
  }

  // nulifies validators, after editmode cancel
  nullifyValidators() {
    this.errors = { name: null, value: null };
  }

  // provides filter mechanism for variables requested in #3985
  getFilteredVariables(variables: VariablePair[]) {
    let reduced = variables.reduce(
      (filtered_variables: VariablePair[], current: VariablePair) => {
        // stores variables, if it's id coincides with received department id and it is based on department
        const byDeptOnly =
          current.department === this.data.department_id &&
          current.based == 'department'
            ? current
            : null;

        // stores variable if department id coincides with received department id and
        // environment or feature ids coincide with received ones, additionally if feature id coincides variable must be based on feature. If environment id coincides, variables must be based on environment.
        const byEnv =
          current.department === this.data.department_id &&
          ((current.environment === this.data.environment_id &&
            current.based == 'environment') ||
            (current.feature === this.data.feature_id &&
              current.based == 'feature'))
            ? current
            : null;

        // pushes stored variables into array if they have value
        byDeptOnly ? filtered_variables.push(byDeptOnly) : null;
        byEnv ? filtered_variables.push(byEnv) : null;

        // removes duplicated variables and returs set like array
        return filtered_variables.filter(
          (value, index, self) =>
            index === self.findIndex(v => v.id === value.id)
        );
      },
      []
    );

    // disables every table row, except the one that is newly created in is still not saved in db
    const clone = reduced.map((item: VariablePair) => {
      return { ...item, disabled: item.id === 0 ? false : true };
    });
    return clone;
  }

  // just disables table rows, filters are not applied. This only happens when template is displayed as child component instead of dialog
  getAllVariables(variables: VariablePair[]) {
    return variables.map((item: VariablePair) => {
      return { ...item, disabled: true };
    });
  }

  // focuses dom element that carries id attribute equal received id
  focusElement(id: string) {
    setTimeout(() => {
      document.getElementById(id).focus();
    }, 0);
  }

  // creates temporary variable object and dispatches it to state, so it is displayed in view and user can fill input fields
  createNewVarInstance() {
    const new_var = <VariablePair>{};

    new_var.id = 0;
    new_var.department = this.data.department_id;
    new_var.environment = this.data.environment_id;
    new_var.department_name = this.data.department_name;
    new_var.environment_name = this.data.environment_name;
    new_var.feature_name = this.data.feature_name;
    new_var.feature = this.data.feature_id === 0 ? null : this.data.feature_id;
    new_var.variable_name = '';
    new_var.variable_value = '';
    new_var.encrypted = false;
    new_var.based = this.defaultBasedValue;
    new_var.in_use = [];
    new_var.disabled = false;

    this._store.dispatch(new Variables.UpdateOrCreateVariable(new_var));
    this.isEditing = true;
  }

  // subscribes to XHR actions and treats returned infromation
  safeSubscriber(action: string, variable?: VariablePair) {
    return {
      next: response => {
        let res = JSON.parse(response);
        if (res.success) {
          action === 'save'
            ? this._store.dispatch(
                new Variables.UpdateOrCreateVariable(
                  res['data'] as VariablePair
                )
              )
            : this._store.dispatch(new Variables.DeleteVariable(variable.id));
          this._snack.open('Action has been completed successfully!', 'OK');
          this.selectionsDisabled = false;
        }
      },
      error: err => {
        this._snack.open(JSON.parse(err.error).error, 'OK');
        this.isEditing = false;
      },
      complete: () => {
        this.isEditing = false;
        this._cdr.detectChanges();
        this.restoreSortState();
      },
    };
  }

  onDepartmentSelect($event){
    this._store.dispatch(new Features.GetFeatures()).subscribe(() => {
      this.features$ = this._store.select(state => state.features.details);
      this.features$.pipe(
        map(features => {
          const featuresArray = Object.values(features);
          this.allFeatures = featuresArray.filter(feature => feature.department_id == this.selectedDepartment.id);
        })
      ).subscribe();
    });
    this.departmentChecked = true;
  }

  onFeatureSelect($event){
    this.featureChecked = true;
    this.checkDoubleSelect();
  }

  checkDoubleSelect() {
    this.depAndFeatChecked = this.departmentChecked && this.featureChecked;
  }

  startFunctions() {
    this.selectionsDisabled = true;
    this.depAndFeatChecked = false;
    
    this.createNewVarInstanceBySelector();

    this.getAllVariablesWithNew(this.variables);
    this.isEditing = true;

    this.applyValidators();
    this.selectedDepartment = null;
    this.selectedFeature = null;
    
    setTimeout(() => {
        this.tableWrapper.nativeElement.scrollTo(0, 0);
        document.getElementById('name-0')?.focus();
    }, 0);
  }

  @HostListener('document:keydown', ['$event'])
  handleKeyboardEvent(event: KeyboardEvent) {
    if(KEY_CODES.ESCAPE){
      this.selectionsDisabled = false;
    }
  }

  getAllVariablesWithNew(variables: VariablePair[]) {
    const allVariables = variables.map((item: VariablePair) => {
        return { ...item, disabled: item.id === 0 ? false : true };
    });
    this.dataSource.data = allVariables;

    return allVariables;
  }

  createNewVarInstanceBySelector(){
    const new_var = <VariablePair>{};

    new_var.id = 0;
    new_var.department = this.selectedDepartment.id;
    new_var.environment = this.selectedFeature.id_enviornment;
    new_var.department_name = this.selectedDepartment.name;
    new_var.environment_name = this.selectedFeature.name_environment;
    new_var.feature_name = this.selectedFeature.name;
    new_var.feature = this.selectedFeature.id === 0 ? null : this.selectedFeature.id;
    new_var.variable_name = '';
    new_var.variable_value = '';
    new_var.encrypted = false;
    new_var.based = this.defaultBasedValue;
    new_var.in_use = [];
    new_var.disabled = false;

    this._store.dispatch(new Variables.UpdateOrCreateVariable(new_var));
    this.isEditing = true;
  }

  // Add new method to update the default based value
  updateDefaultBasedValue(value: string) {
    this.defaultBasedValue = value;
    localStorage.setItem('co_edit_variable_default_based', value);
  }
}