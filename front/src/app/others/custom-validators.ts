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
            name = action.replace(/^(then|when|given|and|if)\s+/i, '');
            // Transform action values to regex
            name = name.replace(/".*?"/gi, '"(.+)"');
            // Removed 'i' flag to enforce strict capitalization matching
            const regex = new RegExp(`^${name}$`, 'gs');
            return regex.test(control.value);
          });

        // Debug: Log if step was found in DB
        this.logger.msg('4', `Step "${control.value}" ${valid ? 'Found in DB' : 'NOT found in DB'}`, 'custom-validators');

        // Special handling for Enterprise Edition actions that might not be in the database
        // Add new EE action patterns here as needed
        if (!valid) {
          const trimmedValue = control.value.trim();
          const eeActionPatterns = [
            /^If\s+"(.+?)"\s+"(.+?)"\s+"(.+?)"$/,  // If "{value1}" "{condition}" "{value2}"
            /^Else$/,     // Else
            /^End\s+If$/,  // End If
          ];
          valid = eeActionPatterns.some(pattern => pattern.test(trimmedValue));
        }
      }
      // Return error with name invalidStep
      if (!valid) return { invalidStep: true };
    }
    // No error detected, is valid
    return null;
  }
}
