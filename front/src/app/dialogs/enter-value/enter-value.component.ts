import { Component, Inject, ChangeDetectionStrategy, HostListener } from '@angular/core';
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
import { InputFocusService } from '@services/inputFocus.service';
import { KEY_CODES } from '@others/enums';

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
  inputFocus: boolean = false;

  constructor(
    private dialogRef: MatDialogRef<EnterValueComponent>,
    @Inject(MAT_DIALOG_DATA) public data: any,
    private fb: UntypedFormBuilder,
    private _api: ApiService,
    private inputFocusService: InputFocusService
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
    // Validate form before submission
    if (!form.value.value || form.value.value.length === 0) {
      return; // Don't submit if form is empty
    }

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

  // Check if focused on input or textarea
  onInputFocus() {
    this.inputFocusService.setInputFocus(true);
  }

  onInputBlur() {
    this.inputFocusService.setInputFocus(false);
  }

  @HostListener('document:keydown', ['$event'])
  handleKeyboardEvent(event: KeyboardEvent) {
    // Handle Ctrl + Enter to submit the form
    if (event.keyCode === KEY_CODES.ENTER && event.ctrlKey) {
      event.preventDefault();
      event.stopPropagation();
      this.handleFormSubmit();
    }
  }

  // Method to handle form submission from keyboard events
  handleFormSubmit() {
    const formValue = this.rForm.value.value;
    if (formValue && formValue.length > 0) {
      this.submit(this.rForm);
    }
  }
}
