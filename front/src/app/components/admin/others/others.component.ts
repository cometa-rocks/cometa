import { Component, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { NgFor, NgIf, AsyncPipe } from '@angular/common';
import { MatLegacyButtonModule } from '@angular/material/legacy-button';
import { MatLegacySnackBar as MatSnackBar } from '@angular/material/legacy-snack-bar';
import { Browsers } from '@store/actions/browsers.actions';
import { Actions } from '@store/actions/actions.actions';
import { Store } from '@ngxs/store';

@Component({
  selector: 'admin-others',
  templateUrl: './others.component.html',
  styleUrls: ['./others.component.scss'],
  imports: [NgFor, NgIf, MatLegacyButtonModule, MatIconModule, AsyncPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
})
export class AdminOthersComponent implements OnInit {
  constructor(private _snack: MatSnackBar,private _store: Store) {}

  ngOnInit() {}

  updateBrowsers() {
    fetch('/backend/parseBrowsers/').then(res => {
      if(res.status == 200){
        this._store.dispatch(new Browsers.GetBrowsers());
        this._snack.open('Browsers updated successfully!', 'OK');
      }
      else{
        this._snack.open('An error ocurred', 'OK');
      }
    });
  }

  updateActions() {
    fetch('/backend/parseActions/').then(res => {
      if(res.status == 200){
        this._store.dispatch(new Actions.GetActions());
        this._snack.open('Step Actions updated successfully!', 'OK');
      }
      else{
        this._snack.open('An error ocurred', 'OK');
      }
    });
  }
}
