import { Component, Inject } from '@angular/core';
import {
  MatLegacyDialogRef as MatDialogRef,
  MAT_LEGACY_DIALOG_DATA as MAT_DIALOG_DATA,
  MatLegacyDialogModule as MatDialogModule,
} from '@angular/material/legacy-dialog';
import { MatLegacyButtonModule } from '@angular/material/legacy-button';

@Component({
  selector: 'app-sure-remove-file',
  templateUrl: './sure-remove-file.component.html',
  styleUrls: ['./sure-remove-file.component.scss'],
  standalone: true,
  imports: [
    MatDialogModule, 
    MatLegacyButtonModule,
  ],
})
export class SureRemoveFileComponent {
  constructor(
    public dialogRef: MatDialogRef<SureRemoveFileComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { fileName: string }
  ) {}
} 