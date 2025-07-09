import { Component, Input, ChangeDetectionStrategy, Output, EventEmitter } from '@angular/core';
import { BrowserComboTextPipe } from '../../../../pipes/browser-combo-text.pipe';
import { StandByBrowserComboTextPipe } from '../../../../pipes/stand-by-browser-combo-text.pipe';
import { DisableAutocompleteDirective } from '../../../../directives/disable-autocomplete.directive';
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
import { MatIconModule } from '@angular/material/icon';
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
import { StandByBrowserHeaderComponent } from './stand-by-browser-header /stand-by-browser-header.component';

import { MatLegacyTooltipModule } from '@angular/material/legacy-tooltip';
import { MatLegacyButtonModule } from '@angular/material/legacy-button';
import { SlicePipe } from '@angular/common';


@Component({
  selector: 'stand-by-browser',
  templateUrl: './stand-by-browser.component.html',
  styleUrls: ['./stand-by-browser.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [
    DisableAutocompleteDirective,
    BrowserComboTextPipe,
    StandByBrowserComboTextPipe,
    ReactiveFormsModule,
    DisableAutocompleteDirective,
    StandByBrowserHeaderComponent,
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
    MatLegacyTooltipModule,
    JsonPipe, 
    MatLegacyCheckboxModule,
    MatLegacyButtonModule,
    SlicePipe,
  ],
})
export class StandByBrowserComponent{
  @Input() stand_by_browsers:  Container[];  
  // @Input() header_stand_by_browsers:  Container[];  
  @Output() checkboxChange = new EventEmitter<boolean>();
   selectedBrowserIds: number[] = [];
  inputFocus: boolean = false;
  @Output() browserRemoved = new EventEmitter<number>();
  
  isLoading = true;

  constructor(
    private inputFocusService: InputFocusService,
    private _api: ApiService,
    private _snack: MatSnackBar,
    private _dialog: MatDialog,
    private _snackBar: MatSnackBar,
    private _store: Store,
    private _cdr: ChangeDetectorRef,
  ) {}

  checked$: Observable<boolean>;


  trackByFn(index: number, item: Container) {
    return item.id;
  }

  ngOnInit() {
  }
  
  // Check if focused on input or textarea
  onInputFocus() {
    this.inputFocusService.setInputFocus(true);
  }

  onInputBlur() {
    this.inputFocusService.setInputFocus(false); 
  }


  removeBrowserContainer(id: number) {
    this._api.deleteContainerServices(id).subscribe(
      (res:any)=> {
        if (res.success) {
          this.browserRemoved.emit(id);
          this._snack.open('Browser stopped successfully!', 'OK');
        }
      },
      err => this._snack.open('An error ocurred', 'OK')
    );
  }


  copyToClipboard(text: string): void {
    navigator.clipboard.writeText(text).then(() => {
      this._snackBar.open('ID copied to clipboard!', 'OK', { duration: 2000 });
    }).catch(err => {
      console.error('Failed to copy text: ', err);
    });
  }

  deleteAllBrowsers(ids: number[]) {
    ids.forEach(id => this.removeBrowserContainer(id));
    this.selectedBrowserIds = []; // clear selection
  }

  onBrowserSelectionChanged(ids: number[]) {
    this.selectedBrowserIds = ids;
    this._cdr.detectChanges(); //  force checkbox state to reflect changes
  }

  onCheckboxToggle(id: number, checked: boolean) {
    if (checked && !this.selectedBrowserIds.includes(id)) {
      this.selectedBrowserIds.push(id);
    } else if (!checked) {
      this.selectedBrowserIds = this.selectedBrowserIds.filter(bid => bid !== id);
    }
  }



}
