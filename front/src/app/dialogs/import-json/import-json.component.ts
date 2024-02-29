import { Component, ChangeDetectionStrategy } from '@angular/core';
import {
  MatLegacyDialogRef as MatDialogRef,
  MatLegacyDialogModule,
} from '@angular/material/legacy-dialog';
import { MatLegacyButtonModule } from '@angular/material/legacy-button';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';
import { MatLegacyInputModule } from '@angular/material/legacy-input';
import { MatLegacyFormFieldModule } from '@angular/material/legacy-form-field';

@Component({
  selector: 'import-json',
  templateUrl: './import-json.component.html',
  styleUrls: ['./import-json.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [
    MatLegacyDialogModule,
    MatLegacyFormFieldModule,
    MatLegacyInputModule,
    ReactiveFormsModule,
    FormsModule,
    MatLegacyButtonModule,
  ],
})
export class ImportJSONComponent {
  constructor(public dialogRef: MatDialogRef<ImportJSONComponent>) {}

  json = '';

  isValid(json: string): boolean {
    try {
      const a = JSON.parse(json);
      return true;
    } catch (err) {
      return false;
    }
  }
}
