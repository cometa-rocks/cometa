import { ChangeDetectionStrategy, Component, Inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { Router } from '@angular/router';

@Component({
  selector: 'data-driven-stop',
  templateUrl: 'data-driven-stop.component.html',
  styleUrls: ['data-driven-stop.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DataDrivenTestStop {
  constructor(
    public dialogRef: MatDialogRef<DataDrivenTestStop>,
    @Inject(MAT_DIALOG_DATA) public data: any,
    private router: Router
  ) {}

  close() {
    this.dialogRef.close();
  }
}
