import { Component, ChangeDetectionStrategy, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { Store } from '@ngxs/store';
import { Observable } from 'rxjs';
import { CustomSelectors } from '@others/custom-selectors';
import { map, switchMap } from 'rxjs/operators';
import { MatLegacyTooltipModule } from '@angular/material/legacy-tooltip';
import { NgIf, AsyncPipe } from '@angular/common';

@Component({
    selector: 'cometa-feature-titles',
    templateUrl: './feature-titles.component.html',
    styleUrls: ['./feature-titles.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
    standalone: true,
    imports: [NgIf, MatLegacyTooltipModule, AsyncPipe]
})
export class FeatureTitlesComponent implements OnInit {

  feature$: Observable<Feature>;

  constructor(
    private _ac: ActivatedRoute,
    private _store: Store
  ) { }

  ngOnInit() {
    // Get feature id from URL Params ans switch to getting feature info from State
    this.feature$ = this._ac.paramMap.pipe(
      map(params => +params.get('feature')),
      switchMap(featureId => this._store.select(CustomSelectors.GetFeatureInfo(featureId)))
    )
  }

}
