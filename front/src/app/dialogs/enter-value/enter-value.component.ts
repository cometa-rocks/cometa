import { Component, Inject, ChangeDetectionStrategy } from '@angular/core';
import { FormBuilder, FormGroup } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { ApiService } from '@services/api.service';

@Component({
  selector: 'enter-value',
  templateUrl: './enter-value.component.html',
  styleUrls: ['./enter-value.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class EnterValueComponent {

  constructor(
    private dialogRef: MatDialogRef<EnterValueComponent>,
    @Inject(MAT_DIALOG_DATA) public data: any,
    private fb: FormBuilder,
    private _api: ApiService
  ) {
    this.rForm = this.fb.group({
      value: [data.value || '']
    });
  }

  rForm: FormGroup;

  getReturn() {
    return {
      word: this.data.word,
      value: this.data.value
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
      default: return false;
    }
  }

}
