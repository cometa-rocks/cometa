import { Component, ChangeDetectionStrategy } from '@angular/core';
import {
  MatDialogRef,
  MatDialogModule,
} from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';

@Component({
  selector: 'import-json',
  templateUrl: './import-json.component.html',
  styleUrls: ['./import-json.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    ReactiveFormsModule,
    FormsModule,
    MatButtonModule,
  ],
})
export class ImportJSONComponent {
  constructor(public dialogRef: MatDialogRef<ImportJSONComponent>) {
    dialogRef.addPanelClass('import-json-dialog-container');
  }

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
