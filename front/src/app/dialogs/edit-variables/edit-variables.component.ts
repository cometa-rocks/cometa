import { Component, Inject, ChangeDetectionStrategy, ChangeDetectorRef, OnInit } from '@angular/core';
import { MatDialog, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { Select, Store } from '@ngxs/store';
import { ApiService } from '@services/api.service';
import { MatSnackBar } from '@angular/material/snack-bar';
import { UserState } from '@store/user.state';
import { switchMap, map } from 'rxjs/operators';
import { Observable } from 'rxjs';
import { VariablesState } from '@store/variables.state';
import { Variables } from '@store/actions/variables.actions';
import { SelectSnapshot, ViewSelectSnapshot } from '@ngxs-labs/select-snapshot';
import { UntypedFormBuilder } from '@angular/forms';
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
  displayedColumns: string[] = ['variable_name','variable_value','encrypted','based', 'actions'];
  bases: string[] = ['feature','department','environment'];
  isEditing: boolean = false;
  errors = { name: null, value: null };
  variables: VariablePair[];


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
     this.variables = data;
     this.variables.map(item => item['disabled'] = true);
    })
  }

  onEditVar(variable: VariablePair) {
    this.isEditing = true;
    variable.disabled = false;
  }

  onSaveVar(variable: VariablePair) {
    let action = variable.id === 0 ? this.createVariable(variable) : this.patchVariable(variable);

    action.pipe(switchMap(res =>
      this._store.dispatch(new Variables.GetVariables()).pipe(map(_ => res)))).subscribe(res => {
        this.isEditing = false;
        variable.disabled = true;
        this._cdr.detectChanges();
      });
  }

  onDeleteVar(variable: VariablePair) {
    let action = this.deleteVariable(variable.id);
    action.pipe(switchMap(res =>
        this._store.dispatch(new Variables.GetVariables()).pipe(map(_ => res)))).subscribe(res => {
            this._cdr.detectChanges();
    });
  }

  onAddVar() {
    this.createNewVarInstance();
    this.errors = { name: {required : true}, value: {required: true} };
    this.isEditing = true;
  }

  setInputStatus(errors: any, control: string) {
    this.errors[control] = errors;
  }

  createVariable(variable: VariablePair) {
    return this._api.setVariable(variable)
  }

  patchVariable(variable: VariablePair) {
    return this._api.patchVariable(variable)
  }

  deleteVariable(id: number) {
    return this._api.deleteVariable(id)
  }

  createNewVarInstance() {
    const user_id = this._store.selectSnapshot(UserState.GetUserId);
    const new_var = <VariablePair>{};
    const date = new Date();

    new_var.id = 0;
    new_var.department = this.data.department_id
    new_var.environment = this.data.environment_id;
    new_var.feature = this.data.feature_id;
    new_var.variable_name = "";
    new_var.variable_value = "";
    new_var.encrypted = false;
    new_var.based = 'feature';
    new_var.in_use = [];
    new_var.created_by = user_id;
    new_var.updated_by = user_id;
    new_var.created_on = date;
    new_var.updated_on = date;
    new_var.disabled = false;

    this.variables = [...this.variables, new_var]
  }


  // nameValidator = Validators.pattern(/^[^\n ]*$/)

  // trackIndex = index => index;

  // add() {
  //   // Add new variable row
  //   this.variablesForm.push(
  //     this._fb.group({
  //       variable_name: ['', this.nameValidator],
  //       variable_value: '',
  //       encrypted: false,
  //       department_id: this.data.department_id,
  //       environment_id: this.data.environment_id,
  //       loading: false
  //     })
  //   )
  //   this.updateFormView();
  // }


  // handleSecretChange(variable: VariablePair, { checked }: MatCheckboxChange) {
  //   // Grab variable value
  //   const value = variable.variable_value
  //   let request: Observable<string> = of(value);
  //   // Check if current value needs decryption
  //   if (value.startsWith(this.encryptionPrefix) && !checked) {
  //     // Show loading on encryption checkbox
  //     this.variablesForm.at(index).patchValue({ loading: true })
  //     this.updateFormView();
  //     request = this._dialog.open(AreYouSureDialog, {
  //       data: {
  //         title: 'translate:you_sure.decrypt_title',
  //         description: 'translate:you_sure.decrypt_desc'
  //       } as AreYouSureData
  //     }).afterClosed().pipe(
  //       finalize(() => {
  //         // Hide loading on encryption checkbox
  //         this.variablesForm.at(index).patchValue({ loading: false })
  //         this.updateFormView();
  //       }),
  //       filter(res => !!res),
  //       map(_ => '')
  //     )
  //   }
  //   // Retrieve encrypted/decrypted value
  //   request.subscribe(decrypted => {
  //     // Update value field
  //     this.variablesForm.at(index).patchValue({ variable_value: decrypted, encrypted: checked })
  //     this.updateFormView();
  //   })
  // }

  // updateFormView() {
  //   // Update view
  //   this.variablesForm.updateValueAndValidity();
  //   this._cdr.detectChanges();
  // }

  // save() {
  //   // Remove empty variable pairs
  //   let variables = this.variablesForm.value as VariablePair[];
  //   variables = variables.filter((variable, i) => {
  //     const remove = !variable.variable_name.length || !variable.variable_value.length
  //     // Also remove them from the FormArray
  //     if (remove) this.variablesForm.removeAt(i);
  //     return !remove;
  //   })
  //   this.updateFormView();
  //   // Save on backend
  //   this._api.setEnvironmentVariables(this.data.environment_id, this.data.department_id, variables)
  //   .pipe(
  //     // Save on store state
  //     switchMap(res => this._store.dispatch( new Variables.GetVariables() ).pipe(
  //       map(_ => res)
  //     ))
  //   )
  //   .subscribe(res => {
  //     if (res.success) {
  //       this._snack.open('Variables saved!', 'OK');
  //       this.dialogRef.close();
  //     } else if (res.handled) {
  //       this.dialogRef.close();
  //     } else {
  //       this._snack.open('Oops, something went wrong.', 'OK');
  //     }
  //   });
  // }

  // deleteVar(index: number) {
  //   // Delete variable row
  //   this.variablesForm.removeAt(index);
  //   this.updateFormView();
  // }
}
