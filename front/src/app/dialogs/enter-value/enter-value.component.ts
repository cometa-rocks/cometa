import { Component, Inject, ChangeDetectionStrategy } from '@angular/core';
import {
  UntypedFormBuilder,
  UntypedFormGroup,
  ReactiveFormsModule,
} from '@angular/forms';
import {
  MatLegacyDialogRef as MatDialogRef,
  MAT_LEGACY_DIALOG_DATA as MAT_DIALOG_DATA,
  MatLegacyDialogModule,
} from '@angular/material/legacy-dialog';
import { ApiService } from '@services/api.service';
import { MatLegacyButtonModule } from '@angular/material/legacy-button';
import { DisableAutocompleteDirective } from '../../directives/disable-autocomplete.directive';
import { MatLegacyInputModule } from '@angular/material/legacy-input';
import { MatLegacyFormFieldModule } from '@angular/material/legacy-form-field';

@Component({
  selector: 'enter-value',
  templateUrl: './enter-value.component.html',
  styleUrls: ['./enter-value.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [
    MatLegacyDialogModule,
    ReactiveFormsModule,
    MatLegacyFormFieldModule,
    MatLegacyInputModule,
    DisableAutocompleteDirective,
    MatLegacyButtonModule,
  ],
})
export class EnterValueComponent {
  constructor(
    private dialogRef: MatDialogRef<EnterValueComponent>,
    @Inject(MAT_DIALOG_DATA) public data: any,
    private fb: UntypedFormBuilder,
    private _api: ApiService
  ) {
    this.rForm = this.fb.group({
      value: [data.value || ''],
    });
  }

  rForm: UntypedFormGroup;

  getReturn() {
    return {
      word: this.data.word,
      value: this.data.value,
    };
  }

  submit(form) {
    // encrypt the password/pin with AES encrypt
    if (this.isSecret(this.data.word)) {
      this._api.encrypt(form.value).subscribe(res => {
        this.dialogRef.close({ word: this.data.word, value: res.result });
      });
    } else {
      this.dialogRef.close({ word: this.data.word, value: form.value });
    }
  }

  isSecret(word): boolean {
    switch (word) {
      case 'password':
      case 'pin':
        return true;
      default:
        return false;
    }
  }
}
