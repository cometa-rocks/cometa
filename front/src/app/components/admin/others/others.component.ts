import {
  Component,
  OnInit,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
} from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { NgFor, NgIf, AsyncPipe } from '@angular/common';
import { MatLegacyButtonModule } from '@angular/material/legacy-button';
import { MatLegacySnackBar as MatSnackBar } from '@angular/material/legacy-snack-bar';
import { Browsers } from '@store/actions/browsers.actions';
import { Actions } from '@store/actions/actions.actions';
import { Store } from '@ngxs/store';
import { ApiService } from '@services/api.service';
import { Observable } from 'rxjs';
import { Subscription } from 'rxjs';
import { HouseKeepingComponent } from './housekeeping/housekeeping.component';
@Component({
  selector: 'admin-others',
  templateUrl: './others.component.html',
  styleUrls: ['./others.component.scss'],
  imports: [
    NgFor,
    NgIf,
    MatLegacyButtonModule,
    MatIconModule,
    AsyncPipe,
    HouseKeepingComponent,
  ],
  // changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
})
export class AdminOthersComponent implements OnInit {
  houseKeepingLogs: HouseKeepingLog[];
  private subscription: Subscription;
 
  constructor(
    private _snack: MatSnackBar,
    private _store: Store,
    private _api: ApiService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit() {
    this.subscription = this._api.getHouseKeepingLogs().subscribe(
      logs => {
        this.houseKeepingLogs = logs;
        this.cdr.markForCheck();
      },
      error => {
        console.error('Error fetching logs:', error);
      }
    );
  }

  ngOnDestroy() {
    if (this.subscription) {
      this.subscription.unsubscribe();
    }
  }

  updateBrowsers() {
    fetch('/backend/parseBrowsers/').then(res => {
      if (res.status == 200) {
        this._store.dispatch(new Browsers.GetBrowsers());
        this._snack.open('Browsers updated successfully!', 'OK');
      } else {
        this._snack.open('An error ocurred', 'OK');
      }
    });
  }

  updateActions() {
    fetch('/backend/parseActions/').then(res => {
      if (res.status == 200) {
        this._store.dispatch(new Actions.GetActions());
        this._snack.open('Step Actions updated successfully!', 'OK');
      } else {
        this._snack.open('An error ocurred', 'OK');
      }
    });
  }
}
