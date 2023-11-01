import {
  Component,
  Input,
  ChangeDetectionStrategy,
  Optional,
  Host,
  OnInit,
} from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { MatLegacyDialog as MatDialog } from '@angular/material/legacy-dialog';
import { VideoComponent } from '@dialogs/video/video.component';
import { BehaviorSubject } from 'rxjs';
import { MatLegacySnackBar as MatSnackBar } from '@angular/material/legacy-snack-bar';
import { switchMap } from 'rxjs/operators';
import { NetworkPaginatedListComponent } from '@components/network-paginated-list/network-paginated-list.component';
import { SharedActionsService } from '@services/shared-actions.service';
import { Observable } from 'rxjs';
import { Select } from '@ngxs/store';
import { CustomSelectors } from '@others/custom-selectors';

@Component({
  selector: 'cometa-feature-run',
  templateUrl: './feature-run.component.html',
  styleUrls: ['./feature-run.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FeatureRunComponent {
  @Select(CustomSelectors.GetConfigProperty('percentMode'))
  percentMode$: Observable<boolean>;

  @Input() test: FeatureResult;

  show$ = new BehaviorSubject<boolean>(false);

  constructor(
    private _router: Router,
    private _ac: ActivatedRoute,
    private _dialog: MatDialog,
    private _snack: MatSnackBar,
    public _sharedActions: SharedActionsService,
    @Optional() @Host() private _paginatedList: NetworkPaginatedListComponent
  ) {}

  // get browsers() {
  //   if (this.run?.feature_results.length > 0) {
  //     // Get unique browser icons
  //     const browsers = [];
  //     for (let i = 0; i < this.run.feature_results.length; i++) {
  //       if (this.run.feature_results[i].browser) {
  //         const browser = this.run.feature_results[i].browser.browser;
  //         // Make sure of it's uniqueness
  //         if (browser && !browsers.map(b => b.browser).includes(browser)) {
  //           browsers.push(browser);
  //         }
  //       }
  //     }
  //     return browsers;
  //   } else {
  //     return [];
  //   }
  // }

  openVideo(test: FeatureResult) {
    this._sharedActions
      .loadingObservable(
        this._sharedActions.checkVideo(test.video_url),
        'Loading video'
      )
      .subscribe(
        _ => {
          this._dialog.open(VideoComponent, {
            backdropClass: 'video-player-backdrop',
            panelClass: 'video-player-panel',
            data: test,
          });
        },
        err => this._snack.open('An error ocurred', 'OK')
      );
  }

  changeShow() {
    //   // Go to Step View if we only have 1 result
    //   // if (this.run.feature_results.length === 1) {
    // this.stepView(this.run.run_id, this.run.feature_results[0])
    this.stepView(this.test);
    //   // } else {
    //   //   this.show$.next(!this.show$.getValue());
    //   // }
  }

  trackByFn(index, item: string) {
    return item;
  }

  // stepView(run_id: number, test: FeatureResult) {
  stepView(test: FeatureResult) {
    this._router
      .navigate(['step', test.feature_result_id], { relativeTo: this._ac })
      .then(() => window.scrollTo(0, 0));
  }

  /**
   * Performs the overriding action through the Store
   */
  setResultStatus(test: FeatureResult, status: 'Success' | 'Failed' | '') {
    this.reloadPageAfterAction(
      this._sharedActions.setResultStatus(test, status)
    );
  }

  // /**
  //  * Performs the overriding action through the Store
  //  */
  // setRunStatus(run: FeatureRun, status: 'Success' | 'Failed' | '') {
  //   this.reloadPageAfterAction( this._sharedActions.setRunStatus(run, status) );
  // }

  /**
   * Archives or unarchives a feature run or a feature result
   * @param run FeatureRun
   */
  archive(test: FeatureResult) {
    this.reloadPageAfterAction(this._sharedActions.archive(test));
  }

  // /**
  //  * Archives or unarchives a feature run or a feature result
  //  * @param run FeatureRun
  //  */
  // archive(test: FeatureRun | FeatureResult) {
  //   this.reloadPageAfterAction( this._sharedActions.archive(test) );
  // }

  // deleteFeatureRun(run: FeatureRun) {
  //   this.reloadPageAfterAction( this._sharedActions.deleteFeatureRun(run) );
  // }

  deleteFeatureResult(test: FeatureResult) {
    this.reloadPageAfterAction(this._sharedActions.deleteFeatureResult(test));
  }

  reloadPageAfterAction<T = any>(observable: Observable<T>) {
    observable
      .pipe(switchMap(_ => this._paginatedList.reloadCurrentPage()))
      .subscribe();
  }
}
