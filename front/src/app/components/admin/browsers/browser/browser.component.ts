import { Component, Input, ChangeDetectionStrategy, Output, EventEmitter } from '@angular/core';
import { BrowserComboTextPipe } from '../../../../pipes/browser-combo-text.pipe';
import { DisableAutocompleteDirective } from '../../../../directives/disable-autocomplete.directive';
import { InputFocusService } from '@services/inputFocus.service';
 import { ApiService } from '@services/api.service';
import { MatLegacyDialog as MatDialog } from '@angular/material/legacy-dialog';
import { MatLegacySnackBar as MatSnackBar } from '@angular/material/legacy-snack-bar';
import { Store, Select } from '@ngxs/store';
import { UserState } from '@store/user.state';
import { BehaviorSubject, Observable } from 'rxjs';
// import { Applications } from '@store/actions/applications.actions';
import {
  AreYouSureData,
  AreYouSureDialog,
} from '@dialogs/are-you-sure/are-you-sure.component';
import { NgIf, NgClass, AsyncPipe } from '@angular/common';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';

@Component({
  selector: 'browser',
  templateUrl: './browser.component.html',
  styleUrls: ['./browser.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [DisableAutocompleteDirective,
    BrowserComboTextPipe,
    ReactiveFormsModule,
    DisableAutocompleteDirective,
    FormsModule,
    NgIf,
    NgClass,
    AsyncPipe,
  ],
})
export class BrowserComponent {
  @Input() browser: BrowserstackBrowser;
  inputFocus: boolean = false;
  
  // @Output() browserAdded = new EventEmitter<Container>();
  @Output() browserAdded = new EventEmitter<Container>();


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

  
  startBrowserContainer(browser: BrowserstackBrowser) {
    let body = {
      "image_name":browser.browser,
      "image_version":browser.browser_version,
      "service_type":"Browser",
      "shared": false,
      "department_id": 1
    }
  
    this._api.startContainerServices(body).subscribe(
      (res:Container)=> {
        console.log("res", res)
        if (res) {
          this.browserAdded.emit(res);
          this._snack.open('Browser started successfully!', 'OK');
        }
      },
      err => this._snack.open('An error ocurred', 'OK')
    );
  }


}
