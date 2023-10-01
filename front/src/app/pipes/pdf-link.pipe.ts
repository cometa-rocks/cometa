import { Pipe, PipeTransform, Inject } from '@angular/core';
import { API_BASE } from 'app/tokens';

@Pipe({
    name: 'pdfLink',
    standalone: true
})
export class PdfLinkPipe implements PipeTransform {

  constructor(
    @Inject(API_BASE) private _base: string
  ) { }

  transform(feature_result_id: number): string {
    // Returns the PDF Download Link using the feature_result_id
    return `${this._base}pdf/?feature_result_id=${feature_result_id}&download=true`;
  }

}
