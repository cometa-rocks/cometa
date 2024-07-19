import { Component, Input, ChangeDetectionStrategy } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { NgIf, NgClass, AsyncPipe } from '@angular/common';
import { DisableAutocompleteDirective } from '../../../../directives/disable-autocomplete.directive';
import { AmDateFormatPipe } from '@pipes/am-date-format.pipe';
import { AmParsePipe } from '@pipes/am-parse.pipe';
import { ShowHousekeepingLogDialog } from '@dialogs/show-housekeeping-logs/show-housekeeping-logs.component';

import { MatLegacyDialog as MatDialog } from '@angular/material/legacy-dialog';


@Component({
  selector: 'housekeeping',
  templateUrl: './housekeeping.component.html',
  styleUrls: ['./housekeeping.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [
    DisableAutocompleteDirective,
    NgIf,
    NgClass,
    MatIconModule,
    AsyncPipe,
    AmDateFormatPipe,
    AmParsePipe,
    ShowHousekeepingLogDialog
  ],
})
export class HouseKeepingComponent {
  
  @Input() houseKeepingLog: HouseKeepingLog;
  @Input() headings: any;

  constructor( private _dialog: MatDialog,) {}

  viewLogs(logID:Number){
    console.log(logID)
    this._dialog.open(ShowHousekeepingLogDialog, {
      disableClose: true,
      autoFocus: false,
      panelClass: '',
      width: '70%',
      data: {
        logId: logID,
      },
    });
  }
}
