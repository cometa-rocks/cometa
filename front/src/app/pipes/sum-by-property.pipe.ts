import { Pipe, PipeTransform } from '@angular/core';
import { sumByProperty } from 'ngx-amvara-toolbox';

@Pipe({
    name: 'sumByProperty',
    standalone: true
})
export class SumByPropertyPipe implements PipeTransform {

  transform(array: any[], prop: string)  {
    return sumByProperty(array, prop);
  }

}
