import { Component, OnInit, ChangeDetectorRef} from '@angular/core';
import { ChangeDetectionStrategy } from '@angular/core';
import { Select } from '@ngxs/store';
import { BrowsersState } from '@store/browsers.state';
import { Observable } from 'rxjs';
import { BrowserComponent } from './browser/browser.component';
import { StandByBrowserComponent } from './stand-by-browser/stand-by-browser.component';

import { NgFor, AsyncPipe, NgIf } from '@angular/common';
import { ApiService } from '@services/api.service';
import { map } from 'rxjs/operators';




@Component({
  selector: 'admin-browsers',
  templateUrl: './browsers.component.html',
  styleUrls: ['./browsers.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [NgFor, NgIf, BrowserComponent, StandByBrowserComponent,AsyncPipe],
})
export class BrowsersComponent  implements OnInit {
  @Select(BrowsersState.getBrowserJsons) browsers$: Observable<
    BrowserstackBrowser[]
  >;

  stand_by_browsers: Container[] = [];
  header_stand_by_browsers: Container[] = [];
  isAnyBrowserRunning$: Observable<boolean>;
  isLoading = true;

  constructor(private _api: ApiService,private _cdr: ChangeDetectorRef,) {}

  trackByFn(index, item: BrowserResult) {
    return item.browser_id;
  }

  ngOnInit() {
    this._api.getContainerServices().subscribe((res: ContainerServiceResponse) => {
      if (res.success) {
        this.stand_by_browsers = res.containerservices;
        
      }
      this.isLoading = false;
      this._cdr.detectChanges();
      
    });


  }

  removeStandByBrowser(id: number) {
    this.stand_by_browsers = this.stand_by_browsers.filter(browser => browser.id !== id);
    this._cdr.detectChanges();
  }

  

  addStandByBrowser(browserContainer: Container) {
    this.stand_by_browsers.push(browserContainer);
    this._cdr.detectChanges();
  }

  
  get runningBrowsers(): Container[] {
    const running = this.stand_by_browsers?.filter(b => b.service_status?.toLowerCase() === 'running') || [];
    return running;
  }




}
