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
   * Handles nested quotes by tracking quote depth
   */
  static removeQuotedParts(step: string): string {
    if (!step) return '';
    
    // Count total quotes to determine if we have properly closed quotes
    const quoteCount = (step.match(/"/g) || []).length;
    
    if (quoteCount === 0) {
      // No quotes found, return the whole string
      return step;
    }
    
    if (quoteCount % 2 === 1) {
      // Odd number of quotes means unclosed quote - be conservative and return the whole string
      // This prevents the system from thinking it's a different step when quotes are incomplete
      return step;
    }
    
    // Even number of quotes - extract the part before the first quote and after the last quote
    const firstQuoteIndex = step.indexOf('"');
    const lastQuoteIndex = step.lastIndexOf('"');
    const beforeQuotes = step.substring(0, firstQuoteIndex);
    const afterQuotes = step.substring(lastQuoteIndex + 1);
    const result = beforeQuotes + afterQuotes;
    
    return result;
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
    const correctQuotePositions: number[] = [];
    for (const part of correctStaticParts) {
      if (part.text === '"') {
        correctQuotePositions.push(part.startPos);
      }
    }
    
    // Get all quote positions in user input
    const userQuotePositions: number[] = [];
    for (let i = 0; i < userInput.length; i++) {
      if (userInput[i] === '"') {
        userQuotePositions.push(i);
      }
    }
    
    console.log('  Matching quotes:');
    console.log('    Correct positions:', correctQuotePositions);
    console.log('    User positions:', userQuotePositions);
    
    // Strategy: Search for text around each correct quote to determine if user has it
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
          console.log(`    Quote at correct[${correctPos}] found at user[${expectedQuotePos}] (via before context: "${beforeContext}")`);
          continue;
        }
      }
      
      // Try after context
      const afterInUser = userInput.indexOf(afterContext);
      if (afterInUser !== -1 && afterInUser > 0) {
        // Found after context - check if there's a quote right before
        if (userInput[afterInUser - 1] === '"') {
          mapping.set(correctPos, true);
          console.log(`    Quote at correct[${correctPos}] found at user[${afterInUser - 1}] (via after context: "${afterContext}")`);
          continue;
        }
      }
      
      // Quote not found
      mapping.set(correctPos, false);
      console.log(`    Quote at correct[${correctPos}] NOT found`);
    }
    
    return mapping;
  }

  /**
   * Compare user input with correct step and return detailed character-by-character info
   * Uses pre-calculated ranges to know exactly what's static vs dynamic
   */
  static compareStepsForOverlay(userInput: string, correctStep: string): { char: string; isMissing: boolean }[] {
    if (!userInput || !correctStep) return [];
    
    console.log('📊 Overlay comparison (Range-based):');
    console.log('  User input:    ', userInput);
    console.log('  Correct step:  ', correctStep);
    
    // Extract static and dynamic ranges from correct step
    const { staticRanges, dynamicRanges } = this.extractStepRanges(correctStep);
    
    console.log('  Static ranges:', staticRanges);
    console.log('  Dynamic ranges:', dynamicRanges);
    
    // Extract static text from correct step
    const correctStaticParts: { text: string, startPos: number, endPos: number }[] = [];
    for (const range of staticRanges) {
      correctStaticParts.push({
        text: correctStep.substring(range.start, range.end),
        startPos: range.start,
        endPos: range.end
      });
    }
    
    console.log('  Static parts:', correctStaticParts.map(p => `"${p.text}"`));
    
    // Check for unbalanced quotes
    const userQuoteCount = (userInput.match(/"/g) || []).length;
    const correctQuoteCount = (correctStep.match(/"/g) || []).length;
    const hasUnbalancedQuotes = userQuoteCount !== correctQuoteCount;
    
    console.log(`  Quotes - User: ${userQuoteCount}, Correct: ${correctQuoteCount}, Unbalanced: ${hasUnbalancedQuotes}`);
    
    // If quotes are unbalanced, use smarter quote matching
    let quoteMapping: Map<number, boolean> | null = null;
    if (hasUnbalancedQuotes) {
      quoteMapping = this.matchQuotes(userInput, correctStep, correctStaticParts);
      console.log('  Quote mapping:', Array.from(quoteMapping.entries()));
    }
    
    // Strategy: Search for each static part in user input (in order)
    // This handles missing characters correctly by finding where each part actually appears
    const missingPositions = new Set<number>();
    let searchFrom = 0;
    
    for (const part of correctStaticParts) {
      console.log(`  Searching for static part [${part.startPos}-${part.endPos}]: "${part.text}"`);
      console.log(`    Searching from user index ${searchFrom}`);
      
      // Special handling for quote characters
      if (part.text === '"') {
        // If we have quote mapping, use it
        if (quoteMapping !== null) {
          const hasQuote = quoteMapping.get(part.startPos) || false;
          if (!hasQuote) {
            missingPositions.add(part.startPos);
            console.log(`    Missing quote at pos ${part.startPos} (via mapping)`);
          } else {
            console.log(`    Quote at pos ${part.startPos} found (via mapping)`);
            // Find next quote in user to advance searchFrom
            const nextQuote = userInput.indexOf('"', searchFrom);
            if (nextQuote !== -1) {
              searchFrom = nextQuote + 1;
            }
          }
          continue;
        }
        
        // No mapping - use proximity search
        const quotePos = userInput.indexOf('"', searchFrom);
        if (quotePos !== -1 && quotePos - searchFrom <= 10) {  // Allow small gap for dynamic content
          console.log(`    Found quote at user index ${quotePos}`);
          searchFrom = quotePos + 1;
        } else {
          // Quote not found
          missingPositions.add(part.startPos);
          console.log(`    Missing quote at pos ${part.startPos}`);
        }
        continue;
      }
      
      // For non-quote parts, use Longest Common Subsequence approach
      // Compare character by character and find what's missing
      let foundAt = userInput.indexOf(part.text, searchFrom);
      
      if (foundAt !== -1 && foundAt - searchFrom <= 20) {
        // Found exact match nearby
        console.log(`    Found exact match at user index ${foundAt}`);
        
        // Check if there are missing chars between searchFrom and foundAt
        if (foundAt > searchFrom) {
          // There's a gap - but it might be dynamic content, so ignore
          console.log(`    Gap of ${foundAt - searchFrom} chars (likely dynamic content)`);
        }
        
        searchFrom = foundAt + part.text.length;
      } else {
        // Not found exactly - compare character by character to find differences
        console.log(`    Not found exactly - comparing char by char`);
        
        let partIdx = 0;
        let userIdx = searchFrom;
        
        while (partIdx < part.text.length && userIdx < userInput.length) {
          if (part.text[partIdx] === userInput[userIdx]) {
            // Match
            partIdx++;
            userIdx++;
          } else {
            // Check if next char matches (missing char in user)
            if (partIdx + 1 < part.text.length && part.text[partIdx + 1] === userInput[userIdx]) {
              // User skipped this character
              missingPositions.add(part.startPos + partIdx);
              console.log(`    Missing at pos ${part.startPos + partIdx}: '${part.text[partIdx]}'`);
              partIdx++;
            } else {
              // User might have extra char or different char
              userIdx++;
            }
          }
        }
        
        // Mark any remaining characters in part as missing
        while (partIdx < part.text.length) {
          missingPositions.add(part.startPos + partIdx);
          console.log(`    Missing at pos ${part.startPos + partIdx}: '${part.text[partIdx]}'`);
          partIdx++;
        }
        
        searchFrom = userIdx;
      }
    }
    
    // Build result array
    const chars: { char: string; isMissing: boolean }[] = [];
    
    for (let i = 0; i < correctStep.length; i++) {
      // Check if this position is in a dynamic range
      const isDynamic = dynamicRanges.some(r => i >= r.start && i < r.end);
      
      if (isDynamic) {
        // Dynamic content - never mark as missing
        chars.push({ char: correctStep[i], isMissing: false });
      } else {
        // Static content - check if missing
        chars.push({ 
          char: correctStep[i], 
          isMissing: missingPositions.has(i)
        });
      }
    }
    
    const missing = chars.filter(c => c.isMissing);
    console.log('  Final missing chars:', missing.map(c => c.char));
    
    return chars;
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
      if (!control || (!control.touched && !control.dirty)) {
        return null;
      }

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
            return regex.test(value);
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
      
      let minDistance = Number.POSITIVE_INFINITY;
      let bestOriginal = '';
      let bestClean = '';

      for (const a of actions) {
        let name = a.action_name?.trim() ?? '';
        name = name.replace(/^(then|when|given|and)\s+/i, '');
        const clean = CustomValidators.removeQuotedParts(name).toLowerCase();
        
        // Use a hybrid approach for distance calculation
        let d = CustomValidators.levenshteinDistance(userClean, clean);
        
        // If the user input has unclosed quotes, also try comparing with the original string
        const userQuoteCount = (value.match(/"/g) || []).length;
        if (userQuoteCount % 2 === 1) {
          // User has unclosed quotes, also compare with original strings
          const originalDistance = CustomValidators.levenshteinDistance(value.toLowerCase(), name.toLowerCase());
          // Use the better (smaller) distance
          d = Math.min(d, originalDistance);
        }
        
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
