import { AbstractControl, ValidationErrors } from '@angular/forms';
import { StepEditorComponent } from '@components/step-editor/step-editor.component';

/**
 * CustomValidators
 * Here we have some custom validators which can be used for FormControls or FormGroups
 */

export class CustomValidators {
  /**
   * Uses to validate steps against actions
   * Steps untouched, pristine or commented are not checked
   * @returns ValidatorFn
   */
  static StepAction(control: AbstractControl): ValidationErrors | null {
    const _this: StepEditorComponent = this as any;
    const { actions } = _this;
    // Check step validity if it has been touched
    if (control.touched || control.dirty) {
      let valid = true;
      // Check if isn't a comment
      if (!control.value.startsWith('#')) {
        // Check coincidences
        valid = actions
          .map(action => action.action_name)
          .some(action => {
            // Remove any possible left or right spaces
            let name = action.trim();
            // Remove prefixes only at the beginning of the string
            name = action.replace(/^(then|when|given|and)\s+/i, '');
            // Transform action values to regex
            name = name.replace(/".*?"/gi, '"(.+)"');
            // Transform action name to regex
            const regex = new RegExp(`^${name}$`, 'gis');
            return regex.test(control.value);
          });
      }
      // Return error with name invalidStep
      if (!valid) return { invalidStep: true };
    }
    // No error detected, is valid
    return null;
  }
}
