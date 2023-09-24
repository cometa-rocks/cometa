import { Pipe, PipeTransform } from '@angular/core';
import { Select } from '@ngxs/store';
import { FeaturesState } from '@store/features.state';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { AmParsePipe } from './am-parse.pipe';

@Pipe({
  name: 'featureSort',
})
export class FeatureSortPipe implements PipeTransform {
  @Select(FeaturesState.GetFeatures) features$: Observable<IFeatureStateDetail>;

  transform(
    ids: number[],
    sort: string,
    reverse: boolean
  ): Observable<number[]> {
    return this.features$.pipe(
      map(details => {
        if (ids.length < 1 || !sort) return ids;
        // Map ids to feature details
        const features = ids.map(id => details[id]);
        if (sort === 'execution') {
          // Make 2 arrays, one with last run info available and another without, only when sorting with Last execution
          const withInfo = features.filter(f => f && !!f.info);
          const withoutInfo = features.filter(f => f && !f.info);
          this.sortFn(sort, withInfo);
          this.sortFn(sort, withoutInfo);
          const result = [
            ...withInfo.map(ft => ft.feature_id),
            ...withoutInfo.map(ft => ft.feature_id),
          ];
          return reverse ? result.reverse() : result;
        } else {
          this.sortFn(sort, features);
          const result = features.map(ft => ft.feature_id);
          return reverse ? result.reverse() : result;
        }
      })
    );
  }

  // Sort function used for features
  sortFn(sort, features: Feature[]) {
    const _amParse = new AmParsePipe();
    switch (sort) {
      case 'feature_id':
        features.sort((a, b) => a.feature_id - b.feature_id);
        features.reverse();
        break;
      case 'feature_name':
        features.sort((a, b) => a.feature_name.localeCompare(b.feature_name));
        break;
      case 'execution':
        features.sort(
          (a, b) =>
            _amParse.transform(a?.info?.result_date).valueOf() -
            _amParse.transform(b?.info?.result_date).valueOf()
        );
        features.reverse();
        break;
      case 'duration':
        features.sort(
          (a, b) =>
            parseInt(`${a?.info?.execution_time}`, 10) -
            parseInt(`${b?.info?.execution_time}`, 10)
        );
        features.reverse();
        break;
      case 'status':
        features.sort((a, b) => {
          if (a?.info?.success) return -1;
          if (b?.info?.success) return 1;
          return 0;
        });
        break;
      case 'last_edited':
        // Compare by last edition date of user
        features.sort(
          (a, b) =>
            _amParse.transform(a?.last_edited_date).valueOf() -
            _amParse.transform(b?.last_edited_date).valueOf()
        );
        features.reverse();
        break;
    }
  }
}
