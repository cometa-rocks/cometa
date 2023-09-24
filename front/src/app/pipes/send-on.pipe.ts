import { Pipe, PipeTransform } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';

@Pipe({
  name: 'sendOn',
})
export class SendOnPipe implements PipeTransform {
  constructor(private _translate: TranslateService) {}

  transform(send_on: Integration['send_on']): string {
    return Object.keys(send_on)
      .map(key => this._translate.instant(`send_on.${key}`))
      .join(',');
  }
}
