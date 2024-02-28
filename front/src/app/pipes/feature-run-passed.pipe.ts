import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'featureRunPassed',
})
export class FeatureRunPassedPipe implements PipeTransform {
  transform(run: FeatureRun): boolean {
    if (run?.status) {
      // Use run status to determine successful
      return run.status === 'Success';
    } else {
      return run?.feature_results.every(result => {
        if (result?.status) {
          // Status to determine successful
          return result.status === 'Success';
        }
        // Use success or fails to determine if result was successful
        return result.success;
      });
    }
  }
}
