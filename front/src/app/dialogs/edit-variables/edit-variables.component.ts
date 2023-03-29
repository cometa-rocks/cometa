import { Component, Inject, ChangeDetectionStrategy, ChangeDetectorRef, OnInit } from '@angular/core';
import { MatDialog, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { Select, Store } from '@ngxs/store';
import { ApiService } from '@services/api.service';
import { MatSnackBar } from '@angular/material/snack-bar';
import { UserState } from '@store/user.state';
import { Observable } from 'rxjs';
import { VariablesState } from '@store/variables.state';
import { Variables } from '@store/actions/variables.actions';
import { SelectSnapshot, ViewSelectSnapshot } from '@ngxs-labs/select-snapshot';
import { AreYouSureData, AreYouSureDialog } from '@dialogs/are-you-sure/are-you-sure.component';

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
export class EditVariablesComponent implements OnInit{
  displayedColumns: string[] = ['variable_name','variable_value','encrypted','based', 'created_by', 'actions'];
  bases: string[] = ['feature','department','environment'];
  isEditing: boolean = false;
  errors = { name: null, value: null };
  variables: VariablePair[];
  variable_backup: VariablePair;


  @Select(VariablesState) variableState$: Observable<VariablePair[]>;
  @ViewSelectSnapshot(UserState.GetPermission('create_variable')) canCreate: boolean;
  @ViewSelectSnapshot(UserState.GetPermission('edit_variable')) canEdit: boolean;
  @ViewSelectSnapshot(UserState.GetPermission('delete_variable')) canDelete: boolean;
  @SelectSnapshot(UserState.RetrieveEncryptionPrefix) encryptionPrefix: string;


  constructor(
    private dialogRef: MatDialogRef<EditVariablesComponent>,
    @Inject(MAT_DIALOG_DATA) public data: PassedData,
    private _store: Store,
    private _snack: MatSnackBar,
    private _api: ApiService,
    private _cdr: ChangeDetectorRef,
    private _dialog: MatDialog
  ) {}

  ngOnInit(): void {
    this.variableState$.subscribe(data => {
      const clone = this.getVariableStateClone(data);
      this.variables = clone.filter(v => v.environment == this.data.environment_id && v.department == this.data.department_id);
    })
  }

  onEditVar(variable: VariablePair) {
    this.variable_backup = {...variable}

    this.isEditing = true;
    variable.disabled = false;
  }

  onSaveVar(variable: VariablePair) {
    let action = variable.id === 0 ? this.createVariable(variable) : this.patchVariable(variable);
    action.subscribe(this.safeSubscriber('save'))
    this._cdr.detectChanges();
  }

  onDeleteVar(variable: VariablePair) {
    let action = this.deleteVariable(variable.id);

    const confirmDialog = this._dialog.open(AreYouSureDialog, {
      data: {
        title: 'translate:you_sure.delete_item_title',
        description: 'translate:you_sure.delete_item_desc'
      } as AreYouSureData
    });

    confirmDialog.afterClosed().subscribe(res => {
      if (res) {
        action.subscribe(this.safeSubscriber('delete', variable));
      }
    })
  }

  onCancelVar(variable: VariablePair) {
    variable.id === 0 ? this.removeNewVarInstance() : this._store.dispatch(new Variables.UpdateOrCreateVariable(this.variable_backup));
    this.nullifyValidators();
    this.isEditing = false;
  }

  onAddVar() {
    this.createNewVarInstance();
    this.applyValidators();
    this.isEditing = true;
  }

  setInputStatus(errors: any, control: string) {
    this.errors[control] = errors;
  }

  createVariable(variable: VariablePair) {
    return this._api.setVariable(variable)
  }

  patchVariable(variable: VariablePair) {
    return this._api.patchVariable(variable);
  }

  deleteVariable(id: number) {
    return this._api.deleteVariable(id);
  }

  applyValidators() {
    this.errors = { name: {required : true}, value: {required: true} };
  }

  nullifyValidators() {
    this.errors = { name: null, value: null };
  }

  getVariableStateClone(variables: VariablePair[]) {
    const clone = variables.map((item: VariablePair) => {
      return {...item, disabled: true}
    })

    return clone;
  }

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

    this.variables = [new_var, ...this.variables]
  }

  removeNewVarInstance() {
    const [, ...rest] = this.variables;
    this.variables = rest;
  }

  safeSubscriber(action: string, variable?: VariablePair) {
    return {
      next: (response) => {
        let res = JSON.parse(response);
        if (res.success) {
          action === 'save' ? this._store.dispatch(new Variables.UpdateOrCreateVariable(res['data'] as VariablePair)) : this._store.dispatch(new Variables.DeleteVariable(variable))
          this._snack.open('Action has been completed successfully!', 'OK');
        }
      },
      error: (err) => {
        this._snack.open(JSON.parse(err.error).error, 'NOK');
      },
      complete: () => {
        this.isEditing = false;
        this._cdr.detectChanges();
      }
    }
  }
}
