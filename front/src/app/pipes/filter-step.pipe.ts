import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'filterStep',
  standalone: true,
})
export class FilterStepPipe implements PipeTransform {
  transform(steps: Action[], search: string, templates: boolean): Action[] {
    search = search.toLowerCase();
    if ((!steps || steps.length === 0 || !search) && !templates) return steps;
    const newSteps = templates
      ? steps.filter(step => step.action_name.includes('given'))
      : steps;
    return newSteps.filter(step =>
      step.action_name.toLowerCase().includes(search)
    );
  }
}
