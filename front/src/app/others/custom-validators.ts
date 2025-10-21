import { AbstractControl, ValidationErrors } from '@angular/forms';
import { StepEditorComponent } from '@components/step-editor/step-editor.component';

/**
 * CustomValidators
 * Here we have some custom validators which can be used for FormControls or FormGroups
 */

export class CustomValidators {
  static logger: any;

  /**
   * Count the number of quotes in a string
   */
  private static countQuotes(text: string): number {
    return (text.match(/"/g) || []).length;
  }

  /**
   * Compute Levenshtein distance between two strings
   * 
   * Calculates the minimum number of single-character edits (insertions, deletions, substitutions)
   * required to transform one string into another.
   * 
   * Examples:
   * - "continuin" → "continuing" = 1 edit (insert 'g')
   * - "enviment" → "environment" = 4 edits (insert 'iron')
   * 
   * @param str1 - User input string (e.g., "continuin")
   * @param str2 - Correct step string (e.g., "continuing")
   * @returns The minimum number of edits needed (lower = more similar)
   */
  static levenshteinDistance(str1: string, str2: string): number {
    // Normalize inputs (handle null/undefined)
    const userInput = str1 ?? '';
    const correctStep = str2 ?? '';
    const userLength = userInput.length;
    const correctLength = correctStep.length;
    
    // Edge cases: if one string is empty, distance = length of the other
    if (userLength === 0) return correctLength;
    if (correctLength === 0) return userLength;

    // Create a 2D distance matrix
    // matrix[row][col] = minimum edits to transform userInput[0..row] into correctStep[0..col]
    const distanceMatrix: number[][] = Array.from(
      { length: userLength + 1 }, 
      () => new Array(correctLength + 1).fill(0)
    );

    // Initialize first column: deleting characters from userInput
    for (let userIndex = 0; userIndex <= userLength; userIndex++) {
      distanceMatrix[userIndex][0] = userIndex;
    }
    
    // Initialize first row: inserting characters to match correctStep
    for (let correctIndex = 0; correctIndex <= correctLength; correctIndex++) {
      distanceMatrix[0][correctIndex] = correctIndex;
    }

    // Fill matrix by comparing each character
    for (let userIndex = 1; userIndex <= userLength; userIndex++) {
      for (let correctIndex = 1; correctIndex <= correctLength; correctIndex++) {
        // If characters match, no cost; otherwise cost = 1 for substitution
        const substitutionCost = userInput[userIndex - 1] === correctStep[correctIndex - 1] ? 0 : 1;
        
        // Calculate minimum cost among three operations:
        distanceMatrix[userIndex][correctIndex] = Math.min(
          distanceMatrix[userIndex - 1][correctIndex] + 1,        // Deletion: remove char from userInput
          distanceMatrix[userIndex][correctIndex - 1] + 1,        // Insertion: add char to userInput
          distanceMatrix[userIndex - 1][correctIndex - 1] + substitutionCost  // Substitution: replace char
        );
      }
    }
    
    // Return bottom-right cell: total minimum edits needed
    return distanceMatrix[userLength][correctLength];
  }

  /**
   * Find the first difference for error messages, preserving quoted parts for better context
   * This version doesn't remove quoted parts to give more meaningful error messages
   */
  static findFirstDifferenceForError(userInput: string, correctStep: string): { index: number; userChar: string; expectedChar: string } | null {
    if (!userInput || !correctStep) return null;
    
    const minLength = Math.min(userInput.length, correctStep.length);
    
    // Compare character by character
    for (let i = 0; i < minLength; i++) {
      if (userInput[i] !== correctStep[i]) {
        return { 
          index: i, 
          userChar: userInput[i] ?? '', 
          expectedChar: correctStep[i] ?? '' 
        };
      }
    }
    
    // If lengths differ, the difference is at the end
    if (userInput.length !== correctStep.length) {
      // const longerString = userInput.length > correctStep.length ? userInput : correctStep;
      const shorterString = userInput.length > correctStep.length ? correctStep : userInput;
      const diffIndex = shorterString.length;
      
      return { 
        index: diffIndex, 
        userChar: userInput[diffIndex] ?? '', 
        expectedChar: correctStep[diffIndex] ?? '' 
      };
    }
    
    return null;
  }

  /**
   * Remove quoted parts from a step to compare only static text outside quotes
   * Handles nested quotes by tracking quote depth
   */
  static removeQuotedParts(step: string): string {
    if (!step) return '';
    
    const quoteCount = CustomValidators.countQuotes(step);
    
    // No quotes found, return the whole string
    if (quoteCount === 0) return step;
    
    // For unbalanced quotes, try to extract static parts more intelligently
    if (quoteCount % 2 === 1) {
      // Look for common step patterns to identify where parameters should be
      // Pattern: "text param_with_quotes" text" -> extract "text" + "text"
      
      // Find the last quote and work backwards to find the parameter start
      const lastQuoteIndex = step.lastIndexOf('"');
      if (lastQuoteIndex > 0) {
        // Look for common step keywords before the last quote to identify parameter boundaries
        const beforeLastQuote = step.substring(0, lastQuoteIndex);
        const afterLastQuote = step.substring(lastQuoteIndex + 1);
        
        // Common step keywords that typically come before parameters
        const stepKeywords = [' to ', ' with ', ' using ', ' for ', ' in ', ' on ', ' at ', ' and '];
        
        let parameterStart = -1;
        for (const keyword of stepKeywords) {
          const keywordIndex = beforeLastQuote.lastIndexOf(keyword);
          if (keywordIndex > parameterStart) {
            parameterStart = keywordIndex + keyword.length;
          }
        }
        
        if (parameterStart > 0) {
          // Extract text before parameter + text after last quote
          const beforeParameter = step.substring(0, parameterStart).trim();
          const afterParameter = afterLastQuote.trim();
          return (beforeParameter + ' ' + afterParameter).trim();
        }
      }
      
      // Fallback: try to extract text before first quote and after last quote
      const firstQuoteIndex = step.indexOf('"');
      const fallbackLastQuoteIndex = step.lastIndexOf('"');
      
      if (firstQuoteIndex > 0 && fallbackLastQuoteIndex > firstQuoteIndex) {
        const beforeFirstQuote = step.substring(0, firstQuoteIndex);
        const afterLastQuote = step.substring(fallbackLastQuoteIndex + 1);
        return (beforeFirstQuote + afterLastQuote).trim();
      } else if (firstQuoteIndex > 0) {
        return step.substring(0, firstQuoteIndex).trim();
      } else if (fallbackLastQuoteIndex > 0) {
        return step.substring(fallbackLastQuoteIndex + 1).trim();
      }
      
      return step;
    }
    
    // Even quotes - extract text before first quote and after last quote
    const firstQuoteIndex = step.indexOf('"');
    const lastQuoteIndex = step.lastIndexOf('"');
    const beforeQuotes = step.substring(0, firstQuoteIndex);
    const afterQuotes = step.substring(lastQuoteIndex + 1);
    
    return beforeQuotes + afterQuotes;
  }

  /**
   * Extract static and dynamic ranges from a step
   * Static = text outside quotes + quotes themselves
   * Dynamic = content inside quotes
   */
  static extractStepRanges(step: string): { staticRanges: {start: number, end: number}[], dynamicRanges: {start: number, end: number}[] } {
    const staticRanges: {start: number, end: number}[] = [];
    const dynamicRanges: {start: number, end: number}[] = [];
    
    const paramPattern = /"[^"]*"/g;
    let match: RegExpExecArray | null;
    let lastEnd = 0;
    
    while ((match = paramPattern.exec(step)) !== null) {
      // Static range before this parameter (including opening quote)
      if (match.index > lastEnd) {
        staticRanges.push({
          start: lastEnd,
          end: match.index  // up to but not including opening quote
        });
      }
      
      // Add opening quote as static
      staticRanges.push({
        start: match.index,
        end: match.index + 1  // just the opening quote
      });
      
      // Dynamic range (content inside quotes)
      dynamicRanges.push({
        start: match.index + 1,
        end: match.index + match[0].length - 1  // excluding both quotes
      });
      
      // Add closing quote as static
      staticRanges.push({
        start: match.index + match[0].length - 1,
        end: match.index + match[0].length  // just the closing quote
      });
      
      lastEnd = match.index + match[0].length;
    }
    
    // Add final static range after last parameter
    if (lastEnd < step.length) {
      staticRanges.push({
        start: lastEnd,
        end: step.length
      });
    }
    
    return { staticRanges, dynamicRanges };
  }

  /**
   * Match quotes between user and correct step intelligently
   * Returns a map of correct quote positions to whether they exist in user
   */
  private static matchQuotes(userInput: string, correctStep: string, correctStaticParts: { text: string, startPos: number, endPos: number }[]): Map<number, boolean> {
    const mapping = new Map<number, boolean>();
    
    // Get all quote positions in correct step (only from static parts)
    const correctQuotePositions = correctStaticParts
      .filter(part => part.text === '"')
      .map(part => part.startPos);
    
    // Search for text around each correct quote to determine if user has it
    for (const correctPos of correctQuotePositions) {
      // Get context before and after the quote
      const beforeContext = correctStep.substring(Math.max(0, correctPos - 5), correctPos);
      const afterContext = correctStep.substring(correctPos + 1, Math.min(correctStep.length, correctPos + 6));
      
      // Search for this context in user input
      const contextInUser = userInput.indexOf(beforeContext);
      if (contextInUser !== -1) {
        // Found before context - check if there's a quote right after
        const expectedQuotePos = contextInUser + beforeContext.length;
        if (userInput[expectedQuotePos] === '"') {
          mapping.set(correctPos, true);
          continue;
        }
      }
      
      // Try after context
      const afterInUser = userInput.indexOf(afterContext);
      if (afterInUser !== -1 && afterInUser > 0 && userInput[afterInUser - 1] === '"') {
        mapping.set(correctPos, true);
        continue;
      }
      
      // Quote not found
      mapping.set(correctPos, false);
    }
    
    return mapping;
  }

  /**
   * Compare user input with correct step and return detailed character-by-character info
   * Shows which characters are missing in the static parts (ignores dynamic content like "{url}")
   */
  static compareStepsForOverlay(userInput: string, correctStep: string): { char: string; isMissing: boolean }[] {
    if (!userInput || !correctStep) return [];
    
    // Step 1: Extract what parts are static (text) vs dynamic (parameters in quotes)
    const { staticRanges, dynamicRanges } = CustomValidators.extractStepRanges(correctStep);
    const staticParts = staticRanges.map(range => ({
      text: correctStep.substring(range.start, range.end),
      position: range.start
    }));
    
    // Step 2: Find which characters are missing
    const missingPositions = CustomValidators.findMissingCharacters(userInput, correctStep, staticParts);
    
    // Step 3: Build result - mark each character as missing or not
    return CustomValidators.buildCharacterArray(correctStep, dynamicRanges, missingPositions);
  }

  /**
   * Find all missing character positions by searching for static parts in user input
   */
  private static findMissingCharacters(
    userInput: string, 
    correctStep: string, 
    staticParts: { text: string; position: number }[]
  ): Set<number> {
    const missing = new Set<number>();
    let searchPosition = 0;
    
    // Check if user has different number of quotes (unbalanced)
    const hasUnbalancedQuotes = CustomValidators.countQuotes(userInput) !== CustomValidators.countQuotes(correctStep);
    const quoteMapping = hasUnbalancedQuotes
      ? CustomValidators.matchQuotes(userInput, correctStep, staticParts.map(p => ({ text: p.text, startPos: p.position, endPos: p.position + p.text.length })))
      : null;
    
    for (const part of staticParts) {
      if (part.text === '"') {
        // Special case: quote character
        searchPosition = CustomValidators.checkQuoteMissing(userInput, part.position, searchPosition, quoteMapping, missing);
      } else {
        // Regular text: check if it exists in user input
        searchPosition = CustomValidators.checkTextMissing(userInput, part, searchPosition, missing);
      }
    }
    
    return missing;
  }

  /**
   * Check if a quote character is missing in user input
   */
  private static checkQuoteMissing(
    userInput: string,
    quotePosition: number,
    searchFrom: number,
    quoteMapping: Map<number, boolean> | null,
    missing: Set<number>
  ): number {
    // Use quote mapping if available (when quotes are unbalanced)
    if (quoteMapping !== null) {
      const hasQuote = quoteMapping.get(quotePosition) || false;
      if (!hasQuote) {
        missing.add(quotePosition);
      } else {
        const nextQuote = userInput.indexOf('"', searchFrom);
        if (nextQuote !== -1) return nextQuote + 1;
      }
      return searchFrom;
    }
    
    // Simple proximity search: is there a quote nearby?
    const quotePos = userInput.indexOf('"', searchFrom);
    if (quotePos !== -1 && quotePos - searchFrom <= 10) {
      return quotePos + 1;
    }
    
    missing.add(quotePosition);
    return searchFrom;
  }

  /**
   * Check if text is missing in user input by comparing character by character
   */
  private static checkTextMissing(
    userInput: string,
    part: { text: string; position: number },
    searchFrom: number,
    missing: Set<number>
  ): number {
    const foundAt = userInput.indexOf(part.text, searchFrom);
    
    // Found exact match nearby? Continue from there
    if (foundAt !== -1 && foundAt - searchFrom <= 20) {
      return foundAt + part.text.length;
    }
    
    // Not found: compare character by character to find what's missing
    let userIndex = searchFrom;
    
    for (let expectedIndex = 0; expectedIndex < part.text.length; expectedIndex++) {
      // Reached end of user input? Mark remaining characters as missing
      if (userIndex >= userInput.length) {
        missing.add(part.position + expectedIndex);
        continue;
      }
      
      if (part.text[expectedIndex] === userInput[userIndex]) {
        // Characters match, move both forward
        userIndex++;
      } else if (expectedIndex + 1 < part.text.length && part.text[expectedIndex + 1] === userInput[userIndex]) {
        // User skipped this character - mark as missing
        missing.add(part.position + expectedIndex);
        // Don't advance userIndex, try to match next expected char
      } else {
        // User has extra or different character - skip it
        userIndex++;
        // Need to check this expected char again with next user char
        expectedIndex--;
      }
    }
    
    return userIndex;
  }

  /**
   * Build final array marking each character as missing or not
   */
  private static buildCharacterArray(
    correctStep: string,
    dynamicRanges: { start: number; end: number }[],
    missingPositions: Set<number>
  ): { char: string; isMissing: boolean }[] {
    const result: { char: string; isMissing: boolean }[] = [];
    
    for (let charPosition = 0; charPosition < correctStep.length; charPosition++) {
      const isDynamic = dynamicRanges.some(range => charPosition >= range.start && charPosition < range.end);
      
      result.push({
        char: correctStep[charPosition],
        isMissing: !isDynamic && missingPositions.has(charPosition)  // Only mark static content as missing
      });
    }
    
    return result;
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
      // if (!control || (!control.touched && !control.dirty)) {
      //   return null;
      // }

      // Comments are always valid
      if (value.startsWith('#')) {
        return null;
      }

      // Exact match check with existing behavior
      let valid = false;
      if (actions && Array.isArray(actions) && actions.length > 0) {
        valid = actions
          .map(a => a.action_name)
          .some(action => {
            let name = action.trim();
            name = name.replace(/^(then|when|given|and)\s+/i, '');
            name = name.replace(/".*?"/gi, '"(.+)"');
            const regex = new RegExp(`^${name}$`, 'gs');
            const isValid = regex.test(value);
            return isValid;
          });
      } else {
        // If we don't have actions, don't block the user
        valid = true;
      }

      if (valid) {
        return null;
      }

      // Build detailed error using closest match logic (ignore quoted parts)
      if (!actions || actions.length === 0) {
        return { invalidStep: true, errorDetails: 'No actions available to validate', closestMatch: null, distance: null } as any;
      }

      const userClean = CustomValidators.removeQuotedParts(value).toLowerCase();
      const hasUnbalancedQuotes = CustomValidators.countQuotes(value) % 2 === 1;
      
      // Debug for your specific case
      if (value.includes('I move mouse to') && value.includes('error')) {
        console.log('🔍 Debug removeQuotedParts:');
        console.log('  Original value:', value);
        console.log('  Quote count:', CustomValidators.countQuotes(value));
        console.log('  Has unbalanced quotes:', hasUnbalancedQuotes);
        console.log('  After removeQuotedParts:', userClean);
        
        // Debug the parameter detection
        if (hasUnbalancedQuotes) {
          const lastQuoteIndex = value.lastIndexOf('"');
          const beforeLastQuote = value.substring(0, lastQuoteIndex);
          const afterLastQuote = value.substring(lastQuoteIndex + 1);
          console.log('  Last quote at position:', lastQuoteIndex);
          console.log('  Before last quote:', beforeLastQuote);
          console.log('  After last quote:', afterLastQuote);
          
          const stepKeywords = [' to ', ' with ', ' using ', ' for ', ' in ', ' on ', ' at ', ' and '];
          let parameterStart = -1;
          for (const keyword of stepKeywords) {
            const keywordIndex = beforeLastQuote.lastIndexOf(keyword);
            if (keywordIndex > parameterStart) {
              parameterStart = keywordIndex + keyword.length;
            }
          }
          console.log('  Parameter start position:', parameterStart);
        }
      }
      
      let minDistance = Number.POSITIVE_INFINITY;
      let bestOriginal = '';

      for (const a of actions) {
        let name = a.action_name?.trim() ?? '';
        name = name.replace(/^(then|when|given|and)\s+/i, '');
        const clean = CustomValidators.removeQuotedParts(name).toLowerCase();
        
        // Calculate distance
        let d = CustomValidators.levenshteinDistance(userClean, clean);
        
        // If user has unclosed quotes, also try comparing with original strings
        if (hasUnbalancedQuotes) {
          const originalDistance = CustomValidators.levenshteinDistance(value.toLowerCase(), name.toLowerCase());
          d = Math.min(d, originalDistance);
        }
        
        // Debug for your specific case
        if (value.includes('I move mouse to') && value.includes('error') && name.includes('I move mouse to')) {
          console.log('🔍 Debug comparison:');
          console.log('  Action name:', name);
          console.log('  Clean action:', clean);
          console.log('  User clean:', userClean);
          console.log('  Distance:', d);
          console.log('  Original distance:', hasUnbalancedQuotes ? CustomValidators.levenshteinDistance(value.toLowerCase(), name.toLowerCase()) : 'N/A');
        }
        
        if (d < minDistance) {
          minDistance = d;
          bestOriginal = name;
        }
      }

      // Set a very strict threshold for similarity (max 20% different, minimum 1 char)
      const maxAllowedDistance = Math.max(1, Math.floor(userClean.length * 0.2));
      const isSimilarEnough = isFinite(minDistance) && minDistance <= maxAllowedDistance;
      
      let suggestion = 'No similar step found';
      let closestMatch = null;
      
      if (bestOriginal && isSimilarEnough) {
        // Use the new error comparison function that preserves quoted parts for better context
        const diff = CustomValidators.findFirstDifferenceForError(value, bestOriginal);
        suggestion = diff
          ? `Character at position ${diff.index + 1}: found '${diff.userChar || '∅'}', expected '${diff.expectedChar || '∅'}'`
          : `Length mismatch: input has ${value.length} chars, expected ${bestOriginal.length} chars`;
        closestMatch = bestOriginal;
      } else {
        // Input is too different from any known step
        suggestion = `No similar step found. Input "${value}" doesn't match any known step definition.`;
      }

      const result = {
        invalidStep: true,
        closestMatch: closestMatch || null,
        errorDetails: suggestion,
        distance: isFinite(minDistance) ? minDistance : null,
      } as any;
      return result;
    } catch (e) {
      // In case of unexpected errors, do not block the form; log if logger available
      console.error('💥 Validator exception:', e);
      try { CustomValidators.logger?.msg?.('1', 'Validator error', 'custom-validators', e); } catch {}
      return null;
    }
  }
}
