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
import { FeatureResultPassedPipe } from '@pipes/feature-result-passed.pipe';
import { PdfLinkPipe } from '@pipes/pdf-link.pipe';
import { PixelDifferencePipe } from '@pipes/pixel-difference.pipe';
import { PercentageFieldPipe } from '@pipes/percentage-field.pipe';
import { BrowserIconPipe } from '@pipes/browser-icon.pipe';
import { SecondsToHumanReadablePipe } from '@pipes/seconds-to-human-readable.pipe';
import { AmDateFormatPipe } from '@pipes/am-date-format.pipe';
import { AmParsePipe } from '@pipes/am-parse.pipe';
import { TranslateModule } from '@ngx-translate/core';
import { MatIconModule } from '@angular/material/icon';
import { MatLegacyButtonModule } from '@angular/material/legacy-button';
import { MatLegacyTooltipModule } from '@angular/material/legacy-tooltip';
import { MatDividerModule } from '@angular/material/divider';
import { MatLegacyMenuModule } from '@angular/material/legacy-menu';
import { StopPropagationDirective } from '../../directives/stop-propagation.directive';
import {
  NgClass,
  NgIf,
  NgTemplateOutlet,
  AsyncPipe,
  TitleCasePipe,
} from '@angular/common';
import { LetDirective } from '../../directives/ng-let.directive';

@Component({
  selector: 'cometa-feature-run',
  templateUrl: './feature-run.component.html',
  styleUrls: ['./feature-run.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [
    LetDirective,
    NgClass,
    NgIf,
    StopPropagationDirective,
    MatLegacyMenuModule,
    MatDividerModule,
    NgTemplateOutlet,
    MatLegacyTooltipModule,
    MatLegacyButtonModule,
    MatIconModule,
    TranslateModule,
    AmParsePipe,
    AmDateFormatPipe,
    SecondsToHumanReadablePipe,
    BrowserIconPipe,
    PercentageFieldPipe,
    PixelDifferencePipe,
    AsyncPipe,
    TitleCasePipe,
    PdfLinkPipe,
    FeatureResultPassedPipe,
  ],
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
