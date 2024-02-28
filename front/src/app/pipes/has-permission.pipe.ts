import { Pipe, PipeTransform } from '@angular/core';
import { Store } from '@ngxs/store';
import { CustomSelectors } from '@others/custom-selectors';
import { Observable } from 'rxjs';

@Pipe({
  name: 'hasPermission',
})
export class HasPermissionPipe implements PipeTransform {
  constructor(private _store: Store) {}

  transform(
    featureId: number,
    permissionName: keyof UserPermissions
  ): Observable<boolean> {
    return this._store.select(
      CustomSelectors.HasPermission(permissionName, featureId)
    );
  }
}
