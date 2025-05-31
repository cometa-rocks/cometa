import { Component } from '@angular/core';
import { MatLegacyDialogRef as MatDialogRef } from '@angular/material/legacy-dialog';
import { CommonModule } from '@angular/common';
import { MatLegacyDialogModule as MatDialogModule } from '@angular/material/legacy-dialog';
import { MatLegacyButtonModule as MatButtonModule } from '@angular/material/legacy-button';

@Component({
  selector: 'app-sure-remove-run',
  templateUrl: './sure-remove-run.component.html',
  styleUrls: ['./sure-remove-run.component.scss'],
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatButtonModule
  ]
})
export class SureRemoveRunComponent {
  static panelClass = 'no-resize-dialog';

  constructor(
    public dialogRef: MatDialogRef<SureRemoveRunComponent>
  ) {}
} 