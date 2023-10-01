import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
    name: 'totalNok',
    standalone: true
})
export class TotalNokPipe implements PipeTransform {

  transform(results: FeatureResult[]): number {
    return results.reduce((r, result) => {
      if (result.fails > 0) {
        return r + result.fails;
      }
      return r;
    }, 0);
  }

}
