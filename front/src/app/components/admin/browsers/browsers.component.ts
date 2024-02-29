import { Component } from '@angular/core';
import { ChangeDetectionStrategy } from '@angular/core';
import { Select } from '@ngxs/store';
import { BrowsersState } from '@store/browsers.state';
import { Observable } from 'rxjs';
import { BrowserComponent } from './browser/browser.component';
import { NgFor, AsyncPipe } from '@angular/common';

@Component({
  selector: 'admin-browsers',
  templateUrl: './browsers.component.html',
  styleUrls: ['./browsers.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [NgFor, BrowserComponent, AsyncPipe],
})
export class BrowsersComponent {
  @Select(BrowsersState.getBrowserJsons) browsers$: Observable<
    BrowserstackBrowser[]
  >;

  trackByFn(index, item: BrowserResult) {
    return item.browser_id;
  }
}
