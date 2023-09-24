import { Pipe, PipeTransform } from '@angular/core';
import { CustomSelectors } from '@others/custom-selectors';

@Pipe({
  name: 'browserResultStatus',
})
export class BrowserResultStatusPipe implements PipeTransform {
  /**
   * Return the status for a given feature run and browser
   * @param feature_id number
   * @param feature_run_id number
   * @param browser BrowserstackBrowser
   */
  transform(
    feature_id: number,
    feature_run_id: number,
    browser: BrowserstackBrowser
  ) {
    return CustomSelectors.GetFeatureBrowserStatus(
      feature_id,
      feature_run_id,
      browser
    );
  }
}
