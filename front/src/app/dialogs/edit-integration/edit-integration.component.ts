import {
  Component,
  ChangeDetectionStrategy,
  Inject,
  OnInit,
  HostListener
} from '@angular/core';
import {
  UntypedFormBuilder,
  UntypedFormGroup,
  Validators,
  ReactiveFormsModule,
} from '@angular/forms';
import {
  MatDialogRef,
  MAT_DIALOG_DATA,
  MatDialogModule,
} from '@angular/material/dialog';
import { ViewSelectSnapshot } from '@ngxs-labs/select-snapshot';
import { Store } from '@ngxs/store';
import { ApiService } from '@services/api.service';
import { SharedActionsService } from '@services/shared-actions.service';
import { Integrations } from '@store/actions/integrations.actions';
import { UserState } from '@store/user.state';
import { switchMap } from 'rxjs/operators';
import { SortByPipe } from '@pipes/sort-by.pipe';
import { MatButtonModule } from '@angular/material/button';
import { MatRadioModule } from '@angular/material/radio';
import { DisableAutocompleteDirective } from '../../directives/disable-autocomplete.directive';
import { MatInputModule } from '@angular/material/input';
import { MatOptionModule } from '@angular/material/core';
import { LetDirective } from '../../directives/ng-let.directive';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { NgIf, NgClass, NgFor } from '@angular/common';
import { InputFocusService } from '@services/inputFocus.service';

@Component({
  selector: 'edit-integration',
  templateUrl: './edit-integration.component.html',
  styleUrls: ['./edit-integration.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [
    MatDialogModule,
    NgIf,
    ReactiveFormsModule,
    MatFormFieldModule,
    MatSelectModule,
    LetDirective,
    NgClass,
    NgFor,
    MatOptionModule,
    MatInputModule,
    DisableAutocompleteDirective,
    MatRadioModule,
    MatButtonModule,
    SortByPipe,
  ],
})
export class EditIntegrationDialog implements OnInit {
  @ViewSelectSnapshot(UserState.RetrieveUserDepartments)
  departments: Department[];
  @ViewSelectSnapshot(UserState.RetrieveIntegrationApps) integrations: string[];

  intForm: UntypedFormGroup;
  inputFocus: boolean = false;

  constructor(
    private dialogRef: MatDialogRef<EditIntegrationDialog>,
    @Inject(MAT_DIALOG_DATA) public data: IntegrationDialogData,
    private _fb: UntypedFormBuilder,
    private _api: ApiService,
    private _sharedActions: SharedActionsService,
    private _store: Store,
    private inputFocusService: InputFocusService
  ) {}

  ngOnInit() {
    // Get send_on if comes from edit
    let sendOn = 'after_test_execution';
    if (this.data.integration?.send_on) {
      sendOn = Object.entries(this.data.integration.send_on).find(
        entry => !!entry[1]
      )[0];
    }
    // Create integration form
    this.intForm = this._fb.group({
      application: [
        this.data.integration?.application || 'Discord',
        Validators.required,
      ],
      department_id: [
        this.data.integration?.department?.department_id ||
          (this.departments.length === 1
            ? this.departments[0].department_id
            : null),
        Validators.required,
      ],
      hook: [
        this.data.integration?.hook || '',
        Validators.compose([
          Validators.required,
          Validators.pattern(/^(http|https):\/\//i),
        ]),
      ],
      send_on: [sendOn, Validators.required],
    });
  }

  createOrEdit(values) {
    // Construct send_on object
    const option = values.send_on;
    values.send_on = {
      [option]: true,
    };
    // Check type of dialog action
    if (this.data.type === 'new') {
      // Create new integration
      this._sharedActions
        .loadingObservable(
          this._api.createIntegration(values),
          'Creating integration'
        )
        .pipe(
          switchMap(int => this._store.dispatch(new Integrations.AddOne(int)))
        )
        .subscribe({ complete: () => this.dialogRef.close() });
    } else {
      // Modify existing integration
      this._sharedActions
        .loadingObservable(
          this._api.patchIntegration(this.data.integration.id, values),
          'Modifying integration'
        )
        .pipe(
          switchMap(int => this._store.dispatch(new Integrations.PatchOne(int)))
        )
        .subscribe({ complete: () => this.dialogRef.close() });
    }
  }
  
  // Check if focused on input or textarea
  onInputFocus() {
    this.inputFocusService.setInputFocus(true);
  }

  onInputBlur() {
    this.inputFocusService.setInputFocus(false);
  }

  // Listen for Ctrl+Enter and trigger createOrEdit if form is valid
  @HostListener('document:keydown', ['$event'])
  handleCtrlEnter(event: KeyboardEvent) {
    if (event.ctrlKey && event.key === 'Enter' && this.intForm?.valid) {
      this.createOrEdit(this.intForm.value);
    }
  }
}

export interface IntegrationDialogData {
  type: 'new' | 'edit';
  integration?: Integration;
}
