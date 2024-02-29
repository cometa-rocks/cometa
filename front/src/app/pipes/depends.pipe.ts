import { Pipe, PipeTransform } from '@angular/core';
import { Select } from '@ngxs/store';
import { FeaturesState } from '@store/features.state';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

@Pipe({
  name: 'depends',
  standalone: true,
})
export class DependsPipe implements PipeTransform {
  @Select(FeaturesState.GetFeatures) details$: Observable<IFeatureStateDetail>;

  transform(featureIds: number[], show: boolean): Observable<number[]> {
    // Filter all feature IDs
    return this.details$.pipe(
      // Filter according to show parameter
      map(details =>
        featureIds.filter(id =>
          show
            ? details[id]?.depends_on_others
            : !details[id]?.depends_on_others
        )
      )
    );
  }
}
