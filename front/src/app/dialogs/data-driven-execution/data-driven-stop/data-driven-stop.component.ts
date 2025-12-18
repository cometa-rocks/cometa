import { ChangeDetectionStrategy, Component, Inject } from '@angular/core';
import { Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { 
  MatDialogModule, 
  MatDialogRef,
  MAT_DIALOG_DATA
} from '@angular/material/dialog';

@Component({
  selector: 'data-driven-stop',
  templateUrl: 'data-driven-stop.component.html',
  styleUrls: ['data-driven-stop.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [MatDialogModule, MatButtonModule],
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
