import { Component, Inject, ChangeDetectionStrategy, HostListener, ChangeDetectorRef, ViewChild, ElementRef } from '@angular/core';
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

  // Reference to the input element
  @ViewChild('valueInput') valueInput: ElementRef<HTMLInputElement>;

  constructor(
    private dialogRef: MatDialogRef<EnterValueComponent>,
    @Inject(MAT_DIALOG_DATA) public data: any,
    private fb: UntypedFormBuilder,
    private _api: ApiService,
    private inputFocusService: InputFocusService,
    private cdr: ChangeDetectorRef
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

  submit(formValue: any) {
    // Ensure we have a value
    if (!formValue || !formValue.value) {
      return;
    }

    // encrypt the password/pin with AES encrypt
    if (this.isSecret(this.data.word)) {
      this._api.encrypt(formValue.value).subscribe(res => {
        this.dialogRef.close({ word: this.data.word, value: res.result });
      });
    } else {
      this.dialogRef.close({ word: this.data.word, value: formValue.value });
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
    if (event.keyCode === KEY_CODES.ENTER && event.ctrlKey) {
      event.preventDefault();
      event.stopPropagation();
      const value = this.rForm.value;
      // If the value is valid, submit as usual
      if (value && value.value && value.value.length > 0) {
        this.submit(value);
        this.cdr.detectChanges(); // Ensure changes are detected
      } else {
        // If the button is disabled, focus the input and mark as touched for error
        // Focus the input element if available
        this.valueInput?.nativeElement.focus(); // Safe focus
        // Mark the control as touched to show validation error (safe navigation)
        this.rForm.get('value')?.markAsTouched();
        // Optionally, trigger change detection
        this.cdr.detectChanges();
      }
    }
  }
}
