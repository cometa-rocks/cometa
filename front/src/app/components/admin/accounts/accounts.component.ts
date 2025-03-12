import { Component, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { Observable, timer, Subject } from 'rxjs';
import { UntypedFormControl, ReactiveFormsModule } from '@angular/forms';
import { debounce, map, startWith } from 'rxjs/operators';
import { AsyncPipe } from '@angular/common';
import { AccountComponent } from './account/account.component';
import { NetworkPaginatedListComponent } from '../../network-paginated-list/network-paginated-list.component';
import { DisableAutocompleteDirective } from '../../../directives/disable-autocomplete.directive';
import { MatLegacyInputModule } from '@angular/material/legacy-input';
import { MatLegacyFormFieldModule } from '@angular/material/legacy-form-field';
import { InputFocusService } from '@services/inputFocus.service';

@Component({
  selector: 'admin-accounts',
  templateUrl: './accounts.component.html',
  styleUrls: ['./accounts.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [
    MatLegacyFormFieldModule,
    MatLegacyInputModule,
    ReactiveFormsModule,
    DisableAutocompleteDirective,
    NetworkPaginatedListComponent,
    AccountComponent,
    AsyncPipe,
  ],
})
export class AccountsComponent implements OnInit {
  inputFocus: boolean = false;
  
  constructor(
    private inputFocusService: InputFocusService
  ){}

  accountsUrl$: Observable<string>;

  search = new UntypedFormControl('');


  ngOnInit() {
    this.accountsUrl$ = this.search.valueChanges.pipe(
      startWith(this.search.value),
      // Set delay of 300ms if search term is provided
      debounce(e => (e ? timer(300) : timer(0))),
      map(search => {
        if (search) {
          return `accounts/?search=${search}`;
        } else {
          return `accounts/`;
        }
      })
    );
  }

  // Check if focused on input or textarea
  onInputFocus() {
    this.inputFocusService.setInputFocus(true);
  }

  onInputBlur() {
    this.inputFocusService.setInputFocus(false);
  }
}
