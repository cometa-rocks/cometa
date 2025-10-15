import { AbstractControl, ValidationErrors } from '@angular/forms';
import { StepEditorComponent } from '@components/step-editor/step-editor.component';

/**
 * CustomValidators
 * Here we have some custom validators which can be used for FormControls or FormGroups
 */

export class CustomValidators {
  static logger: any;
  /**
   * Uses to validate steps against actions
   * Steps untouched, pristine or commented are not checked
   * @returns ValidatorFn
   */
  static StepAction(control: AbstractControl): ValidationErrors | null {
    this.logger.msg('4', '=== StepAction() === EXECUTED for:', 'custom-validators', control.value);
    const _this: StepEditorComponent = this as any;
    const { actions } = _this;
    

    // Commented because it is not needed to check if the step has been touched or dirty
    // if (control.touched || control.dirty) {
      let valid = true;
      // Check if isn't a comment
      if (!control.value.startsWith('#')) {
        // Check coincidences
        valid = actions
        .map(action => action.action_name)
        .some(action => {
          // this.logger.msg('4', '=== StepAction() === Action:', 'custom-validators', action);
          // Remove any possible left or right spaces
          let name = action.trim();
          // this.logger.msg('4', '=== StepAction() === Name:', 'custom-validators', name);
          // Remove prefixes only at the beginning of the string
          name = action.replace(/^(then|when|given|and)\s+/i, '');
          // this.logger.msg('4', '=== StepAction() === Name replaced:', 'custom-validators', name);
          // Transform action values to regex
          name = name.replace(/".*?"/gi, '"(.+)"');
          // this.logger.msg('4', '=== StepAction() === Name replaced 2:', 'custom-validators', name);
          // Removed 'i' flag to enforce strict capitalization matching
          const regex = new RegExp(`^${name}$`, 'gs');
          this.logger.msg('4', '=== StepAction() === Control value:', 'custom-validators', control.value);
          this.logger.msg('4', '=== StepAction() === Regex:', 'custom-validators', regex);
          return regex.test(control.value);
        });

        // Debug: Log if step was found in PRELOAD DATA
        this.logger.msg('4', `Step "${control.value}" ${valid ? 'Found in PRELOAD DATA' : 'NOT found in PRELOAD DATA'}`, 'custom-validators');

      }
      // Return error with name invalidStep
      if (!valid) return { invalidStep: true };
    // }
    // No error detected, is valid
    return null;
  }
}
