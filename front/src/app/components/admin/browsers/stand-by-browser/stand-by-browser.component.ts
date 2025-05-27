import { Component, Input, ChangeDetectionStrategy, Output, EventEmitter } from '@angular/core';
import { BrowserComboTextPipe } from '../../../../pipes/browser-combo-text.pipe';
import { StandByBrowserComboTextPipe } from '../../../../pipes/stand-by-browser-combo-text.pipe';
import { DisableAutocompleteDirective } from '../../../../directives/disable-autocomplete.directive';
import { InputFocusService } from '@services/inputFocus.service';
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
    FormsModule,
    NgIf,
    NgClass,
    AsyncPipe,
    NgFor,
    AmParsePipe,
    AmDateFormatPipe,
    SecondsToHumanReadablePipe,
    FirstLetterUppercasePipe,
    JsonPipe
  ],
})
export class StandByBrowserComponent{
  @Input() stand_by_browsers:  Container[];
  inputFocus: boolean = false;
  @Output() browserRemoved = new EventEmitter<number>();
  isLoading = true;

  constructor(
    private inputFocusService: InputFocusService,
    private _api: ApiService,
    private _snack: MatSnackBar,
    private _dialog: MatDialog,
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

}
