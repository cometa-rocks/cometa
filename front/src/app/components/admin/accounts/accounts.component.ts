import { Component, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { Observable, timer } from 'rxjs';
import { FormControl } from '@angular/forms';
import { debounce, map, startWith } from 'rxjs/operators';

@Component({
  selector: 'admin-accounts',
  templateUrl: './accounts.component.html',
  styleUrls: ['./accounts.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AccountsComponent implements OnInit {

  accountsUrl$: Observable<string>;

  search = new FormControl('');

  ngOnInit() {
    this.accountsUrl$ = this.search.valueChanges.pipe(
      startWith(this.search.value),
      // Set delay of 300ms if search term is provided
      debounce(e => e ? timer(300) : timer(0)),
      map(search => {
        if (search) {
          return `accounts/?search=${search}`;
        } else {
          return `accounts/`;
        }
      })
    )
  }

}
