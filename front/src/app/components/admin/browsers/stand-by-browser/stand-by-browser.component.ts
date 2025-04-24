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
import {
  AreYouSureData,
  AreYouSureDialog,
} from '@dialogs/are-you-sure/are-you-sure.component';
import { NgIf, NgClass, AsyncPipe } from '@angular/common';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';

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
  ],
})
export class StandByBrowserComponent {
  @Input() stand_by_browser: Container;
  inputFocus: boolean = false;
  @Output() browserRemoved = new EventEmitter<number>();

  constructor(
    private inputFocusService: InputFocusService,
    private _api: ApiService,
    private _snack: MatSnackBar,
    private _dialog: MatDialog,
    private _store: Store,
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
