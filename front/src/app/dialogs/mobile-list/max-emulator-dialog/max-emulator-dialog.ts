import { Component, Inject } from '@angular/core';
import {
  MatLegacyDialogRef as MatDialogRef,
  MatLegacyDialogModule,
} from '@angular/material/legacy-dialog';
import { MatLegacyButtonModule } from '@angular/material/legacy-button';
import { NgIf } from '@angular/common';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatListModule } from '@angular/material/list';

@Component({
  selector: 'max-emulator-dialog',
  templateUrl: 'max-emulator-dialog.html',
  styleUrls: ['max-emulator-dialog.scss'],
  standalone: true,
  imports: [MatLegacyDialogModule, NgIf, MatLegacyButtonModule, MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatListModule
  ],
})
export class MaxEmulatorDialogComponent {
  runningEmulators: { id: number; name: string }[];
  departmentName: string;

  constructor(
    private dialogRef: MatDialogRef<MaxEmulatorDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: any,
  ) {
    this.runningEmulators = data.runningEmulators;
    this.departmentName = data.departmentName;
  }

  closeDialog() {
    this.dialogRef.close();
  }
}
