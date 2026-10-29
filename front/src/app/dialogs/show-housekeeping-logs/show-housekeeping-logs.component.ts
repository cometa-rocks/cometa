import {
  Component,
  Inject,
  ChangeDetectionStrategy,
  OnInit,
  ChangeDetectorRef
} from '@angular/core';
import { ApiService } from '@services/api.service';
import { ReactiveFormsModule } from '@angular/forms';
import {
  MatDialogRef,
  MAT_DIALOG_DATA,
  MatDialogModule,
} from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { SortByPipe } from '@pipes/sort-by.pipe';
import { AmDateFormatPipe } from '@pipes/am-date-format.pipe';
import { AmParsePipe } from '@pipes/am-parse.pipe';
import { MatButtonModule } from '@angular/material/button';
import { MatOptionModule } from '@angular/material/core';
import { NgFor, AsyncPipe, KeyValuePipe, NgIf } from '@angular/common';
import { MatSelectModule } from '@angular/material/select';
import { DisableAutocompleteDirective } from '../../directives/disable-autocomplete.directive';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'show-housekeeping-log-dialog',
  templateUrl: './show-housekeeping-logs.component.html',
  styleUrls: ['./show-housekeeping-logs.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    DisableAutocompleteDirective,
    MatSelectModule,
    NgFor,
    NgIf,
    MatOptionModule,
    MatButtonModule,
    AmParsePipe,
    AmDateFormatPipe,
    SortByPipe,
    AsyncPipe,
    KeyValuePipe,
    MatProgressSpinnerModule,
  ],
})
export class ShowHousekeepingLogDialog implements OnInit {
  houseKeepingLog!: HouseKeepingLogs;
  logs:string = ""
  constructor(
    private dialogRef: MatDialogRef<ShowHousekeepingLogDialog>,
    private _api: ApiService,
    private snack: MatSnackBar,
    @Inject(MAT_DIALOG_DATA) public data: any,
    private cdr: ChangeDetectorRef
  ) {
    console.log(this.data);
  }

  loadHouseKeepingLogs()
  {
    this.houseKeepingLog = undefined;
    this.cdr.markForCheck();
    this._api.getHouseKeepingLog(this.data.logId).subscribe(
    res => {
      if (res) {
        this.logs = "";
        this.houseKeepingLog = res;
        for (let log of this.houseKeepingLog.house_keeping_logs){
          const spaces = '&nbsp;&nbsp;&nbsp;&nbsp;'.repeat(log.spacing); // Generate the required number of non-breaking spaces
          const logText = `${log.formatted_date} ${spaces}${log.value}`;
          const logHtml = log.type === 'normal' 
            ? `<p>${logText}</p>`
            : `<p class="red-text">${logText}</p>`;

          this.logs=this.logs+logHtml;
        }   
        this.cdr.markForCheck();
      } else {
        this.dialogRef.close();
        this.snack.open('Did not find logs or error ocurred', 'OK');
      }
    },
    () => {
      this.dialogRef.close();
      this.snack.open('Did not find logs or error ocurred', 'OK');
    }
  );
  }

  ngOnInit(): void {
    this.loadHouseKeepingLogs()
  }
}
