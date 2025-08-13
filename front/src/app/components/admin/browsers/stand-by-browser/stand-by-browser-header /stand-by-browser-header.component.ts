import { Component, Input, ChangeDetectionStrategy, Output, EventEmitter } from '@angular/core';
import { BrowserComboTextPipe } from '../../../../../pipes/browser-combo-text.pipe';
import { StandByBrowserComboTextPipe } from '../../../../../pipes/stand-by-browser-combo-text.pipe';
import { DisableAutocompleteDirective } from '../../../../../directives/disable-autocomplete.directive';
import { InputFocusService } from '@services/inputFocus.service';
import { map } from 'rxjs/operators';
import { ApiService } from '@services/api.service';
import { MatLegacyDialog as MatDialog } from '@angular/material/legacy-dialog';
import { MatLegacySnackBar as MatSnackBar } from '@angular/material/legacy-snack-bar';
import { Store, Select } from '@ngxs/store';
import { UserState } from '@store/user.state';
import { BehaviorSubject, Observable } from 'rxjs';
import { Applications } from '@store/actions/applications.actions';
import { JsonPipe } from '@angular/common';
import {
  AreYouSureData,
  AreYouSureDialog,
} from '@dialogs/are-you-sure/are-you-sure.component';
import { NgFor,NgIf, NgClass, AsyncPipe } from '@angular/common';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';
import { OnInit, ChangeDetectorRef} from '@angular/core';
import { SecondsToHumanReadablePipe } from '@pipes/seconds-to-human-readable.pipe';
import { AmDateFormatPipe } from '@pipes/am-date-format.pipe';
import { AmParsePipe } from '@pipes/am-parse.pipe';
import { FirstLetterUppercasePipe } from '@pipes/first-letter-uppercase.pipe';
import { MatLegacyCheckboxModule } from '@angular/material/legacy-checkbox';
import { Browsers } from '@store/actions/browsers.actions';
import { MatIconModule } from '@angular/material/icon';


import { MatLegacyButtonModule } from '@angular/material/legacy-button';


@Component({
  selector: 'stand-by-browser-header',
  templateUrl: './stand-by-browser-header.component.html',
  styleUrls: ['./stand-by-browser-header.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [
    DisableAutocompleteDirective,
    BrowserComboTextPipe,
    StandByBrowserComboTextPipe,
    ReactiveFormsModule,
    DisableAutocompleteDirective,
    FormsModule,
    MatIconModule,
    NgIf,
    NgClass,
    AsyncPipe,
    NgFor,
    AmParsePipe,
    AmDateFormatPipe,
    SecondsToHumanReadablePipe,
    FirstLetterUppercasePipe,
    JsonPipe, 
    MatLegacyCheckboxModule,
    MatLegacyButtonModule
  ],
})
export class StandByBrowserHeaderComponent{

  @Input() stand_by_browsers:  Container[];  
  toExport = new BehaviorSubject<number[]>([]);
  @Output() checkboxChange = new EventEmitter<boolean>();
  @Input() header_stand_by_browsers: Container[] = [];
 
  @Output() deleteMultiple = new EventEmitter<number[]>();

  // Emits selected IDs to parent for selection only (not deletion)
 @Output() selectionChanged = new EventEmitter<number[]>();



  constructor(
    private inputFocusService: InputFocusService,
    private _api: ApiService,
    private _snack: MatSnackBar,
    private _dialog: MatDialog,
    private _snackBar: MatSnackBar,
    private _store: Store,
    private _cdr: ChangeDetectorRef,
  ) {}

  
  
  // Check if focused on input or textarea
  onInputFocus() {
    this.inputFocusService.setInputFocus(true);
  }

  onInputBlur() {
    this.inputFocusService.setInputFocus(false); 
  }


  ngOnInit() {
   this.header_stand_by_browsers = this.stand_by_browsers ?? []; // fallback to empty
  }


  selectAll() {
    if (!this.header_stand_by_browsers || this.header_stand_by_browsers.length === 0) {
      this._snackBar.open('No browsers available to select.', 'OK', { duration: 3000 });
      return;
    }

    const allSelected = this.toExport.getValue().length === this.header_stand_by_browsers.length;

    if (!allSelected) {
      //  Select all browser IDs
      const selectedIds = this.header_stand_by_browsers.map(f => f.id);
      this.toExport.next(selectedIds);
      this.selectionChanged.emit(selectedIds); //  Just mark selected
    } else {
      //  Deselect all
      this.toExport.next([]);
      this.selectionChanged.emit([]); //  Deselect all
    }
  }


  deleteAll() {
    const selectedIds = this.toExport.getValue();

    if (selectedIds.length === 0) {
      this._snackBar.open('Please select all browsers first.', 'OK', { duration: 3000 });
      return;
    }

    

    if (selectedIds.length === 0) {
      this._snackBar.open('Please select browsers before deleting.', 'OK', { duration: 3000 });
      return;
    }

    //  Emit selected IDs to parent to trigger deletion
    this.deleteMultiple.emit(selectedIds);
    this.toExport.next([]);
  }
}
