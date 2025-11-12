import { Component } from '@angular/core';
import { MatDialogRef } from '@angular/material/dialog';
import { CommonModule } from '@angular/common';
import { MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';

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