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
  MatLegacyDialogRef as MatDialogRef,
  MAT_LEGACY_DIALOG_DATA as MAT_DIALOG_DATA,
  MatLegacyDialogModule,
} from '@angular/material/legacy-dialog';
import { MatLegacySnackBar as MatSnackBar } from '@angular/material/legacy-snack-bar';

import { SortByPipe } from '@pipes/sort-by.pipe';
import { AmDateFormatPipe } from '@pipes/am-date-format.pipe';
import { AmParsePipe } from '@pipes/am-parse.pipe';
import { MatLegacyButtonModule } from '@angular/material/legacy-button';
import { MatLegacyOptionModule } from '@angular/material/legacy-core';
import { NgFor, AsyncPipe, KeyValuePipe, NgIf } from '@angular/common';
import { MatLegacySelectModule } from '@angular/material/legacy-select';
import { DisableAutocompleteDirective } from '../../directives/disable-autocomplete.directive';
import { MatLegacyInputModule } from '@angular/material/legacy-input';
import { MatLegacyFormFieldModule } from '@angular/material/legacy-form-field';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'show-housekeeping-log-dialog',
  templateUrl: './show-housekeeping-logs.component.html',
  styleUrls: ['./show-housekeeping-logs.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [
    CommonModule,
    MatLegacyDialogModule,
    ReactiveFormsModule,
    MatLegacyFormFieldModule,
    MatLegacyInputModule,
    DisableAutocompleteDirective,
    MatLegacySelectModule,
    NgFor,
    NgIf,
    MatLegacyOptionModule,
    MatLegacyButtonModule,
    AmParsePipe,
    AmDateFormatPipe,
    SortByPipe,
    AsyncPipe,
    KeyValuePipe,

  ],
})
export class ShowHousekeepingLogDialog implements OnInit {
  houseKeepingLog!: HouseKeepingLog;
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



  ngOnInit(): void {
    this._api.getHouseKeepingLog(this.data.logId).subscribe(
      res => {
        console.log(res);
        if (res) {
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
}
