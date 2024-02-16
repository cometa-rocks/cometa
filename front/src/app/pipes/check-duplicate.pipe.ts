import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'checkDuplicate',
})
export class CheckDuplicatePipe implements PipeTransform {
  transform(step: string, importedSteps: string[]): boolean {
    return importedSteps.includes(step);
  }
}
