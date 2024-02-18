import { Pipe, PipeTransform } from '@angular/core';
import { Store } from '@ngxs/store';

@Pipe({
  name: 'storeSelector',
})
export class StoreSelectorPipe implements PipeTransform {
  constructor(private _store: Store) {}

  transform(selector): unknown {
    return this._store.select(selector);
  }
}
