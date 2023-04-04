import { Component, Inject, ChangeDetectionStrategy, ChangeDetectorRef, OnInit, ViewChild, OnDestroy, ElementRef } from '@angular/core';
import { MatDialog, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { Select, Store } from '@ngxs/store';
import { ApiService } from '@services/api.service';
import { MatSnackBar } from '@angular/material/snack-bar';
import { UserState } from '@store/user.state';
import { map, Observable, Subject, takeUntil } from 'rxjs';
import { VariablesState } from '@store/variables.state';
import { Variables } from '@store/actions/variables.actions';
import { ViewSelectSnapshot } from '@ngxs-labs/select-snapshot';
import { AreYouSureData, AreYouSureDialog } from '@dialogs/are-you-sure/are-you-sure.component';
import { MatSort, Sort } from '@angular/material/sort';
import { MatTableDataSource } from '@angular/material/table';

interface PassedData {
  environment_id: number;
  department_id: number;
  feature_id: number;
}

@Component({
  selector: 'edit-variables',
  templateUrl: './edit-variables.component.html',
  styleUrls: ['./edit-variables.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class EditVariablesComponent implements OnInit, OnDestroy {
  displayedColumns: string[] = ['variable_name','variable_value','encrypted','based', 'created_by_name', 'actions'];
  bases: string[] = ['feature','environment','department'];
  isEditing: boolean = false;
  errors = { name: null, value: null };
  variables: VariablePair[];
  variable_backup: VariablePair;
  destroy$ = new Subject<void>();
  dataSource;



  @ViewChild('tableWrapper') tableWrapper: ElementRef;
  @ViewChild(MatSort) sort: MatSort;
  @Select(VariablesState) variableState$: Observable<VariablePair[]>;
  @ViewSelectSnapshot(UserState.GetPermission('create_variable')) canCreate: boolean;
  @ViewSelectSnapshot(UserState.GetPermission('edit_variable')) canEdit: boolean;
  @ViewSelectSnapshot(UserState.GetPermission('delete_variable')) canDelete: boolean;


  constructor(
    @Inject(MAT_DIALOG_DATA) public data: PassedData,
    private _store: Store,
    private _snack: MatSnackBar,
    private _api: ApiService,
    private _cdr: ChangeDetectorRef,
    private _dialog: MatDialog,
  ) {}

  ngOnInit(): void {
    this.variableState$.pipe(
      takeUntil(this.destroy$),
      map(variables => variables.filter(v => v.environment == this.data.environment_id && v.department == this.data.department_id)))
      .subscribe(data => {
        this.variables = this.getVariableStateClone(data);
        this.dataSource = new MatTableDataSource(this.variables);

        // Inbuilt MatTableDataSource.filterPredicate determines which columns filter term must be applied to
        this.dataSource.filterPredicate = (row: VariablePair, filter: string) => {
          return row.variable_name.toLocaleLowerCase().includes(filter) || row.based.toLocaleLowerCase().includes(filter);
        };
      })
  }

  ngOnDestroy(): void {
    // destroy subscription
    this.destroy$.next();
    this.destroy$.complete();

    // when this dialog is closed, remove any variable with id 0 from variable state.
    this.variables.forEach(variable => {
      if (variable.id === 0) {
        this._store.dispatch(new Variables.DeleteVariable(variable.id))
      }
    })
  }

  onEditVar(variable: VariablePair) {
    // if user is currently editing some variable row and double click is performed on different variable row, give feedback message and return
    // this snack feedback message will only be provided if user tries to edit variable with double click mouse event, while another variable is being edited.
    if (this.isEditing && variable.disabled) {
      this._snack.open('Please save changes in order to edit another variable.', 'OK');
      return;
    }


    // save backup of current state of variable in case user wants to cancel changes
    this.variable_backup = {...variable}

    // notify view that currently there is a variable that is being edited and enable table row that variable is located at.
    this.isEditing = true;
    variable.disabled = false;

    // focus enabled row
    setTimeout(() => {
      document.getElementById(`${variable.id}`).focus();
    },0);
  }

  onSaveVar(variable: VariablePair) {
    // If input validators are invalid, return
    // this condition will only be fired when user tries to save variable with ENTER keyboard event
    if (this.errors.name || this.errors.value){
      return;
    }

    // removes from state variable with id 0 (if it exists)
    this._store.dispatch(new Variables.DeleteVariable(0))

    // Depending on if user is creating new variable or is patching existing one
    // next piece of code updates existing variable in state or replaces the removed variable(with id 0) with the one that is received from XHR
    let action = variable.id === 0 ? this.createVariable(variable) : this.patchVariable(variable);
    action.subscribe(this.safeSubscriber('save'))
  }

  onDeleteVar(variable: VariablePair) {
    // defines action to be realized, in this case > Delete
    let action = this.deleteVariable(variable.id);

    // opens confirmation dialog, to prevent accidental elimination
    const confirmDialog = this._dialog.open(AreYouSureDialog, {
      data: {
        title: 'translate:you_sure.delete_item_title',
        description: 'translate:you_sure.delete_item_desc'
      } as AreYouSureData
    });

    // if dialogs result is 'yes/true', removes variable completes action to eliminate variable
    confirmDialog.afterClosed().subscribe(res => {
      if (res) {
        action.subscribe(this.safeSubscriber('delete', variable));
      }
    })
  }

  onCancelVar(variable: VariablePair, event: Event) {
    // stop propagation if user cancels modification by clicking ESC key, this will prevent whole popup from closing
    if(event) event.stopImmediatePropagation();

    // if users is cancelling the process of creation of new variable, dispaches delete event to remove it from state
    // if user is cancelling the process of modification of already existing variable, dispatches update event to set variable to its previous state
    variable.id === 0 ? this._store.dispatch(new Variables.DeleteVariable(variable.id)) : this._store.dispatch(new Variables.UpdateOrCreateVariable(this.variable_backup));
    this.variable_backup = null;

    // Nulify validatrs for newly created variables
    this.nullifyValidators();

    // notify view that user is no longer editing any variable
    this.isEditing = false;
  }

  // fired when user clicks on Add Variable button
  onAddVar() {
    // creates and dispatches new temporary variable object to state, so it gets rendered in view
    this.createNewVarInstance();

    // scrolls up to top and focuses newly created variable
    setTimeout(() => {
      this.applyValidators();
      this.isEditing = true;
      this.tableWrapper.nativeElement.scrollTo(0,0);
      document.getElementById("0").focus();
    },0);
  }

  // is fired when, sorting of any column is change on table
  announceSortChange(sortState: Sort) {
    this.dataSource.sort = this.sort;
  }

  // Receives string from search input and adds it to dataSource as filterTerm.
  applyFilter(event: Event) {
    const filterValue = (event.target as HTMLInputElement).value;
    this.dataSource.filter = filterValue.trim().toLowerCase();
  }

  // binded to (input) event. Actualizes input's validator status every time user focuses out of input
  setInputStatus(errors: any, control: string) {
    this.errors[control] = errors;
  }

  // create variable XHR
  createVariable(variable: VariablePair) {
    return this._api.setVariable(variable)
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
    this.errors = { name: {required : true}, value: {required: true} };
  }

  // nulifies validators, after editmode cancel
  nullifyValidators() {
    this.errors = { name: null, value: null };
  }


  // set every variable in array to disabled state, except newly created one (the one with id 0)
  getVariableStateClone(variables: VariablePair[]) {
    const clone = variables.map((item: VariablePair) => {   return {...item, disabled: item.id === 0 ? false : true}   })
    return clone;
  }

  // creates temporary variable object and dispatches it to state, so it is displayed in view and user can fill input fields
  createNewVarInstance() {
    const new_var = <VariablePair>{};

    new_var.id = 0;
    new_var.department = this.data.department_id
    new_var.environment = this.data.environment_id;
    new_var.feature = this.data.feature_id;
    new_var.variable_name = "";
    new_var.variable_value = "";
    new_var.encrypted = false;
    new_var.based = 'feature';
    new_var.in_use = [];
    new_var.disabled = false;

    this._store.dispatch(new Variables.UpdateOrCreateVariable(new_var))
    this.isEditing = true;
  }

  // subscribes to XHR actions and treats returned infromation
  safeSubscriber(action: string, variable?: VariablePair) {
    return {
      next: (response) => {
        let res = JSON.parse(response);
        if (res.success) {
          action === 'save' ? this._store.dispatch(new Variables.UpdateOrCreateVariable(res['data'] as VariablePair)) : this._store.dispatch(new Variables.DeleteVariable(variable.id))
          this._snack.open('Action has been completed successfully!', 'OK');
        }
      },
      error: (err) => {
        this._snack.open(JSON.parse(err.error).error, 'OK');
        this.isEditing = false;
      },
      complete: () => {
        this.isEditing = false;
        this._cdr.detectChanges();
      }
    }
  }
}
