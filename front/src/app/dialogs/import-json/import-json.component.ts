import { Component, ChangeDetectionStrategy } from '@angular/core';
import { MatLegacyDialogRef as MatDialogRef } from '@angular/material/legacy-dialog';

@Component({
  selector: 'import-json',
  templateUrl: './import-json.component.html',
  styleUrls: ['./import-json.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ImportJSONComponent {

  constructor(
    public dialogRef: MatDialogRef<ImportJSONComponent>
  ) { }

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
