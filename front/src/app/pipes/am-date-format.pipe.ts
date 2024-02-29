import { Pipe, PipeTransform } from '@angular/core';
import { SelectSnapshot } from '@ngxs-labs/select-snapshot';
import { ConfigState } from '@store/config.state';
import { format } from 'date-fns';
import enLocale from 'date-fns/locale/en-US';
import esLocale from 'date-fns/locale/es';
import deLocale from 'date-fns/locale/de';

@Pipe({
  name: 'amDateFormat',
  standalone: true,
})
export class AmDateFormatPipe implements PipeTransform {
  locales = {
    es: esLocale,
    de: deLocale,
    en: enLocale,
  };

  @SelectSnapshot(ConfigState.GetLanguage) language: string;

  transform(value: Date, formato: string): string {
    return format(value, formato, {
      locale: this.locales[this.language],
    });
  }
}
