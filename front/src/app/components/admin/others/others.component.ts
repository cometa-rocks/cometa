import {
  Component,
  OnInit,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Inject
} from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { NgFor, NgIf, AsyncPipe } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Browsers } from '@store/actions/browsers.actions';
import { Actions } from '@store/actions/actions.actions';
import { Store } from '@ngxs/store';
import { ApiService } from '@services/api.service';
import { Observable } from 'rxjs';
import { Subscription } from 'rxjs';
import { HouseKeepingComponent } from './housekeeping/housekeeping.component';
import { API_BASE } from 'app/tokens';

@Component({
  selector: 'admin-others',
  templateUrl: './others.component.html',
  styleUrls: ['./others.component.scss'],
  imports: [
    NgFor,
    NgIf,
    MatButtonModule,
    MatIconModule,
    AsyncPipe,
    HouseKeepingComponent,
  ],
  // changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
})
export class AdminOthersComponent implements OnInit {
  houseKeepingLogs: HouseKeepingLogs[];
  private subscription: Subscription;
   
  constructor(
    private _snack: MatSnackBar,
    private _store: Store,
    private _api: ApiService,
    private cdr: ChangeDetectorRef,
    @Inject(API_BASE) private _api_base: string
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

    // `url(${this.api_base}screenshot/${screenshot}/)`
    fetch(`${this._api_base}parseBrowsers/`).then(res => {
      if (res.status == 200) {
        this._store.dispatch(new Browsers.GetBrowsers());
        this._snack.open('Browsers updated successfully!', 'OK');
      } else {
        this._snack.open('An error ocurred', 'OK');
      }
    });
  }

  updateActions() {
    fetch(`${this._api_base}parseActions/`).then(res => {
      if (res.status == 200) {
        this._store.dispatch(new Actions.GetActions());
        this._snack.open('Step Actions updated successfully!', 'OK');
      } else {
        this._snack.open('An error ocurred', 'OK');
      }
    });
  }

  // Update the mobile list
  updateMobilesList() {
    fetch(`${this._api_base}parse_mobiles/`)
      .then(res => res.json()) 
      .then(data => {
        // Update the mobiles list
        this.houseKeepingLogs = data; 
        this.cdr.markForCheck(); 
        this._snack.open('Mobiles list updated successfully!', 'OK');
      })
      .catch(() => {
        this._snack.open('An error occurred while updating mobiles list', 'OK');
      });
  }
  
  // Update the cometa browsers
  updateCometaBrowsers() {
    fetch(`${this._api_base}parseCometaBrowsers/`)
      .then(res => res.json())
      .then(success => { 
        // Boolean value to check if the update was successful 
        if (success) {
          this._snack.open('Cometa browsers updated successfully!', 'OK');
        } else {
          this._snack.open('Failed to update Cometa browsers.', 'OK');
        }
      })
      .catch(() => {
        this._snack.open('An error occurred while updating Cometa browsers', 'OK');
      });
  }
  
  
  triggerHouseKeeping() {
    this.subscription = this._api.runHouseKeeping().subscribe(
      (response:any) => {
          console.log(response)
          this.houseKeepingLogs = [response.house_keeping_logs, ...this.houseKeepingLogs];        
          this.cdr.markForCheck();
          this._snack.open(`In background housekeeping thread is running, refer log ID : ${response.house_keeping_logs.id}, please do not run again! `, 'OK');        
      },
      error => {
        console.error('Error fetching logs:', error);
        this._snack.open('An error occurred, please check django service logs', 'OK');
      }
    );
  }


}
