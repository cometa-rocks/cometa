import { Pipe, PipeTransform } from '@angular/core';
import { Select } from '@ngxs/store';
import { CustomSelectors } from '@others/custom-selectors';
import { combineLatest, isObservable, Observable } from 'rxjs';
import { distinctUntilChanged, map } from 'rxjs/operators';

@Pipe({
  name: 'archivedRuns',
})
export class ArchivedRunsPipe implements PipeTransform {
  /** This variable holds the Internal Options of Config */
  @Select(CustomSelectors.GetConfigProperty('internal'))
  options$: Observable<InternalOptions>;

  /**
   * Return filterArchived function using Observable
   * @param runs FeatureRun[]
   * @returns Observable<FeatureRun[]>
   */
  transform(
    runs: FeatureRun[] | Observable<FeatureRun[]>
  ): Observable<FeatureRun[]> {
    // Extract archived options from options$ in a Observable fashion
    const archived$ = this.options$.pipe(
      // Map to showArchived property
      map(options => options.showArchived),
      // Don't emit values until there's a changed value
      distinctUntilChanged()
    );
    // Check if input is of type Observable
    // This lets the developer use two type of inputs
    if (isObservable(runs)) {
      // Combine archived option and runs
      return combineLatest([runs, archived$]).pipe(
        // Return filtered runs
        map(([runs, archived]) => this.filterArchived(runs, archived))
      );
    } else {
      return archived$.pipe(
        // Return filtered runs
        map(archived => this.filterArchived(runs, archived))
      );
    }
  }

  /**
   * Function used to filter runs based on archived parameter
   * @param runs FeatureRun[]
   * @param archived boolean
   */
  filterArchived(runs: FeatureRun[], archived: boolean): FeatureRun[] {
    if (archived) {
      return runs.filter(run => run.archived);
    } else {
      return runs.filter(run => !run.archived);
    }
  }
}
