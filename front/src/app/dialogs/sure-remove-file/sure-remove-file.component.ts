import { Component, Inject } from '@angular/core';
import {
  MatDialogRef,
  MAT_DIALOG_DATA,
  MatDialogModule,
} from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';

@Component({
  selector: 'app-sure-remove-file',
  templateUrl: './sure-remove-file.component.html',
  styleUrls: ['./sure-remove-file.component.scss'],
  standalone: true,
  imports: [
    MatDialogModule, 
    MatButtonModule,
  ],
})
export class SureRemoveFileComponent {
  static panelClass = 'no-resize-dialog';

  constructor(
    public dialogRef: MatDialogRef<SureRemoveFileComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { fileName: string }
  ) {}
} 