import { Pipe, PipeTransform } from '@angular/core';
import { SelectSnapshot } from '@ngxs-labs/select-snapshot';
import { CustomSelectors } from '@others/custom-selectors';

@Pipe({
    name: 'alreadyTakenFilter',
    standalone: true
})
export class AlreadyTakenFilterPipe implements PipeTransform {

  // Key filters allowed to add multiple instances
  allowedMultiple = ['app', 'env', 'dept', 'test'];

  @SelectSnapshot(CustomSelectors.GetConfigProperty('filters')) filters: Filter[];

  transform(alreadyTaken: Array<filterPossibility>): Array<filterPossibility> {
    if (!alreadyTaken) return [];
    const ids = alreadyTaken.map(item => item.id);
    return this.filters.filter(item => {
      return ids.indexOf(item.id) === -1 || this.allowedMultiple.includes(item.id);
    });
  }

}

interface filterPossibility {
  id: string;
  value?: number | string;
  title: string;
  text: string;
  rangeText?: string;
  range1?: string;
  range2?: string;
  date?: string;
}
