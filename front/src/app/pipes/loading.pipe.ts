import { Pipe, PipeTransform } from '@angular/core';
import { Select } from '@ngxs/store';
import { LoadingsState } from '@store/loadings.state';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

@Pipe({
    name: 'loading',
    standalone: true
})
export class LoadingPipe implements PipeTransform {

  @Select(LoadingsState) loadings$: Observable<ILoadingsState>;

  transform(id: string | number): Observable<boolean> {
    return this.loadings$.pipe( map(loadings => loadings[id]) )
  }

}
