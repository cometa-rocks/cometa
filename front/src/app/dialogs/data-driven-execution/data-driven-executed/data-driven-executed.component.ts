import { ChangeDetectionStrategy, Component, Inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { Router } from '@angular/router';
import { MatLegacyButtonModule } from '@angular/material/legacy-button';
import { MatLegacyDialogModule } from '@angular/material/legacy-dialog';

@Component({
  selector: 'data-driven-executed',
  templateUrl: 'data-driven-executed.component.html',
  styleUrls: ['data-driven-executed.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [MatLegacyDialogModule, MatLegacyButtonModule],
})
export class DataDrivenTestExecuted {
  constructor(
    public dialogRef: MatDialogRef<DataDrivenTestExecuted>,
    @Inject(MAT_DIALOG_DATA) public data: any,
    private router: Router
  ) {}

  onNoClick() {
    this.dialogRef.close();
  }

  go() {
    this.router.navigate(['data-driven', this.data.run_id]);
    this.dialogRef.close();
  }
}
