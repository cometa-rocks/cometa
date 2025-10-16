import { AbstractControl, ValidationErrors } from '@angular/forms';
import { StepEditorComponent } from '@components/step-editor/step-editor.component';

/**
 * CustomValidators
 * Here we have some custom validators which can be used for FormControls or FormGroups
 */

export class CustomValidators {
  static logger: any;

  /**
   * Compute Levenshtein distance between two strings
   */
  static levenshteinDistance(str1: string, str2: string): number {
    const a = str1 ?? '';
    const b = str2 ?? '';
    const len1 = a.length;
    const len2 = b.length;
    if (len1 === 0) return len2;
    if (len2 === 0) return len1;

    const matrix: number[][] = Array.from({ length: len1 + 1 }, () => new Array(len2 + 1).fill(0));

    for (let i = 0; i <= len1; i++) matrix[i][0] = i;
    for (let j = 0; j <= len2; j++) matrix[0][j] = j;

    for (let i = 1; i <= len1; i++) {
      for (let j = 1; j <= len2; j++) {
        const cost = a[i - 1] === b[j - 1] ? 0 : 1;
        matrix[i][j] = Math.min(
          matrix[i - 1][j] + 1, // deletion
          matrix[i][j - 1] + 1, // insertion
          matrix[i - 1][j - 1] + cost // substitution
        );
      }
    }
    return matrix[len1][len2];
  }

  /**
   * Find the first index where two strings differ.
   */
  static findFirstDifference(userInput: string, correctStep: string): { index: number; userChar: string; expectedChar: string } | null {
    const minLength = Math.min(userInput.length, correctStep.length);
    for (let i = 0; i < minLength; i++) {
      if (userInput[i] !== correctStep[i]) {
        return { index: i, userChar: userInput[i] ?? '', expectedChar: correctStep[i] ?? '' };
      }
    }
    if (userInput.length !== correctStep.length) {
      // First difference is at end if lengths differ
      return { index: minLength, userChar: userInput[minLength] ?? '', expectedChar: correctStep[minLength] ?? '' };
    }
    return null;
  }

  /**
   * Remove quoted parts from a step to compare only static text outside quotes
   */
  static removeQuotedParts(step: string): string {
    if (!step) return '';
    return step.replace(/".*?"/g, '');
  }

  /**
   * Validate steps against actions and return detailed error info when invalid
   */
  static StepAction(control: AbstractControl): ValidationErrors | null {
    try {
      const _this: StepEditorComponent = this as any;
      const { actions } = _this || { actions: [] };
      const value: string = control?.value ?? '';

      // Skip if untouched or blank
      if (!control || (!control.touched && !control.dirty)) return null;

      // Comments are always valid
      if (value.startsWith('#')) return null;

      // Exact match check with existing behavior
      let valid = false;
      if (actions && Array.isArray(actions) && actions.length > 0) {
        valid = actions
          .map(a => a.action_name)
          .some(action => {
            let name = action.trim();
            name = name.replace(/^(then|when|given|and|if)\s+/i, '');
            name = name.replace(/".*?"/gi, '"(.+)"');
            const regex = new RegExp(`^${name}$`, 'gs');
            return regex.test(value);
          });
      } else {
        // If we don't have actions, don't block the user
        valid = true;
      }

      if (valid) return null;

      // Build detailed error using closest match logic (ignore quoted parts)
      if (!actions || actions.length === 0) {
        return { invalidStep: true, errorDetails: 'No actions available to validate', closestMatch: null, distance: null } as any;
      }

      const userClean = CustomValidators.removeQuotedParts(value).toLowerCase();
      let minDistance = Number.POSITIVE_INFINITY;
      let bestOriginal = '';
      let bestClean = '';

      for (const a of actions) {
        let name = a.action_name?.trim() ?? '';
        name = name.replace(/^(then|when|given|and|if)\s+/i, '');
        const clean = CustomValidators.removeQuotedParts(name).toLowerCase();
        const d = CustomValidators.levenshteinDistance(userClean, clean);
        if (d < minDistance) {
          minDistance = d;
          bestOriginal = name;
          bestClean = clean;
        }
      }

      let suggestion = 'No similar step found';
      if (bestOriginal) {
        const diff = CustomValidators.findFirstDifference(CustomValidators.removeQuotedParts(value), CustomValidators.removeQuotedParts(bestOriginal));
        suggestion = diff
          ? `Character at position ${diff.index + 1}: found '${diff.userChar || '∅'}', expected '${diff.expectedChar || '∅'}'`
          : `Length mismatch: input has ${CustomValidators.removeQuotedParts(value).length} chars, expected ${CustomValidators.removeQuotedParts(bestOriginal).length} chars`;
      }

      return {
        invalidStep: true,
        closestMatch: bestOriginal || null,
        errorDetails: suggestion,
        distance: isFinite(minDistance) ? minDistance : null,
      } as any;
    } catch (e) {
      // In case of unexpected errors, do not block the form; log if logger available
      try { CustomValidators.logger?.msg?.('1', 'Validator error', 'custom-validators', e); } catch {}
      return null;
    }
  }
}
