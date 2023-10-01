import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
    name: 'featureResultPassed',
    standalone: true
})
export class FeatureResultPassedPipe implements PipeTransform {

    transform(result: FeatureResult): boolean {
        if (result?.status) {
            // Use result status to determine successful
            return result.status === 'Success';
        } else {
            return result.success;
        }
    }

}
