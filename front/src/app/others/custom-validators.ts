import { AbstractControl, ValidationErrors } from '@angular/forms';

/**
 * CustomValidators
 * Here we have some custom validators which can be used for FormControls or FormGroups
 */

export class CustomValidators {
  static logger: any;


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
   * Find the first difference for error messages, using a smarter comparison
   * that focuses on static text while handling parameters intelligently
   */
  static findFirstDifferenceForError(userInput: string, correctStep: string): { index: number; userChar: string; expectedChar: string } | null {
    if (!userInput || !correctStep) return null;
    
    console.log('🔍 Smart comparison:');
    console.log('  User input:', userInput);
    console.log('  Correct step:', correctStep);
    
    // Extract static text from both strings (ignoring parameters)
    const userStatic = CustomValidators.extractStaticTextSimple(userInput);
    const correctStatic = CustomValidators.extractStaticTextSimple(correctStep);
    
    console.log('🔍 Static text comparison:');
    console.log('  User static:', userStatic);
    console.log('  Correct static:', correctStatic);
    console.log('📋 CLEANED STEPS COMPARISON:');
    console.log('  👤 USER CLEANED:    "' + userStatic + '"');
    console.log('  ✅ CORRECT CLEANED: "' + correctStatic + '"');
    
    // Compare static text character by character
    const minLength = Math.min(userStatic.length, correctStatic.length);
    
    for (let i = 0; i < minLength; i++) {
      if (userStatic[i] !== correctStatic[i]) {
        console.log(`🔍 Difference in static text at position ${i}: '${userStatic[i]}' vs '${correctStatic[i]}'`);
        
        // Map back to original position
        const originalIndex = CustomValidators.mapStaticToOriginal(userInput, userStatic, i);
        return { 
          index: originalIndex, 
          userChar: userStatic[i], 
          expectedChar: correctStatic[i] 
        };
      }
    }
    
    // If lengths differ, the difference is at the end
    if (userStatic.length !== correctStatic.length) {
      const shorterLength = Math.min(userStatic.length, correctStatic.length);
      const originalIndex = CustomValidators.mapStaticToOriginal(userInput, userStatic, shorterLength);
      
      if (userStatic.length < correctStatic.length) {
        console.log(`🔍 User missing characters, expected: '${correctStatic[shorterLength]}'`);
        return { 
          index: originalIndex, 
          userChar: '', 
          expectedChar: correctStatic[shorterLength] 
        };
      } else {
        console.log(`🔍 User has extra characters: '${userStatic[shorterLength]}'`);
      return { 
          index: originalIndex, 
          userChar: userStatic[shorterLength], 
          expectedChar: '' 
        };
      }
    }
    
    // If static text is identical, compare original strings for typos
    if (userStatic === correctStatic) {
      console.log(`🔍 Static text identical, checking for typos in original strings`);
      return CustomValidators.findTypoInOriginalStrings(userInput, correctStep);
    }
    
    return null;
  }

  /**
   * Find typos in original strings when static text is identical
   */
  private static findTypoInOriginalStrings(userInput: string, correctStep: string): { index: number; userChar: string; expectedChar: string } | null {
    console.log(`🔍 Checking for typos in original strings:`);
    console.log(`  User: "${userInput}"`);
    console.log(`  Correct: "${correctStep}"`);
    
    // Extract static text with position mapping
    const userStatic = CustomValidators.extractStaticWithPositions(userInput);
    const correctStatic = CustomValidators.extractStaticWithPositions(correctStep);
    
    console.log(`🔍 User static with positions:`, userStatic);
    console.log(`🔍 Correct static with positions:`, correctStatic);
    
    // Compare static text character by character
    const minLength = Math.min(userStatic.text.length, correctStatic.text.length);
    
    for (let i = 0; i < minLength; i++) {
      if (userStatic.text[i] !== correctStatic.text[i]) {
        console.log(`🔍 Typo found at static position ${i}: '${userStatic.text[i]}' vs '${correctStatic.text[i]}'`);
        console.log(`🔍 Original position: ${userStatic.positions[i]}`);
        return { 
          index: userStatic.positions[i], 
          userChar: userStatic.text[i], 
          expectedChar: correctStatic.text[i] 
        };
      }
    }
    
    // If lengths differ, the difference is at the end
    if (userStatic.text.length !== correctStatic.text.length) {
      const shorterLength = Math.min(userStatic.text.length, correctStatic.text.length);
      
      if (userStatic.text.length < correctStatic.text.length) {
        console.log(`🔍 User missing characters, expected: '${correctStatic.text[shorterLength]}'`);
        const originalIndex = userStatic.positions[shorterLength - 1] + 1;
        return { 
          index: originalIndex, 
          userChar: '', 
          expectedChar: correctStatic.text[shorterLength] 
        };
      } else {
        console.log(`🔍 User has extra characters: '${userStatic.text[shorterLength]}'`);
        return { 
          index: userStatic.positions[shorterLength], 
          userChar: userStatic.text[shorterLength], 
          expectedChar: '' 
        };
      }
    }
    
    return null;
  }
  
  /**
   * Extract static text with position mapping
   */
  private static extractStaticWithPositions(step: string): { text: string; positions: number[] } {
    let text = '';
    let positions: number[] = [];
    
    console.log(`🔍 Extracting static with positions from: "${step}"`);
    
    // Use replaceQuotesWithMarkers to handle nested quotes correctly
    const withMarkers = CustomValidators.replaceQuotesWithMarkers(step);
    
    console.log(`🔍 With markers: "${withMarkers}"`);
    
    // Now iterate through both strings simultaneously
    let markerIndex = 0;
    let stepIndex = 0;
    
    while (markerIndex < withMarkers.length && stepIndex < step.length) {
      if (withMarkers[markerIndex] === '●') {
        console.log(`🔍 Found opening marker at markerIndex=${markerIndex}, stepIndex=${stepIndex}`);
        
        // This is the opening marker (replaces opening quote)
        // Skip until we find the corresponding closing marker
        markerIndex++; // Skip opening marker
        stepIndex++;   // Skip opening quote
        
        // Skip all content until closing marker
        while (markerIndex < withMarkers.length && withMarkers[markerIndex] !== '●') {
          markerIndex++;
          stepIndex++;
        }
        
        // Skip closing marker and quote
        if (markerIndex < withMarkers.length && withMarkers[markerIndex] === '●') {
          markerIndex++; // Skip closing marker
          stepIndex++;   // Skip closing quote
        }
        
        console.log(`🔍 After skipping parameter: markerIndex=${markerIndex}, stepIndex=${stepIndex}`);
      } else {
        // Regular character, keep it
        text += step[stepIndex];
        positions.push(stepIndex);
        markerIndex++;
        stepIndex++;
      }
    }
    
    console.log(`🔍 Final static text: "${text}"`);
    console.log(`🔍 Final positions:`, positions);
    
    return { text, positions };
  }

  /**
   * Extract static text from a string, removing all parameter content (simple version)
   */
  private static extractStaticTextSimple(step: string): string {
    console.log(`🔍 Extracting static text from: "${step}"`);
    
    // Use regex to remove all quoted content (including nested quotes)
    // This pattern matches: "content" where content can contain nested quotes
    const result = step.replace(/"([^"]*(?:"[^"]*)*)"/g, '');
    
    console.log(`🔍 Final static text: "${result}"`);
    return result;
  }

  /**
   * Map position in static text back to original string position
   */
  private static mapStaticToOriginal(original: string, staticText: string, staticPos: number): number {
    let originalPos = 0;
    let staticPosCount = 0;
    
    for (let i = 0; i < original.length; i++) {
      if (original[i] === '"') {
        // Skip opening quote
        i++;
        
        // Skip all content until closing quote
        while (i < original.length && original[i] !== '"') {
          i++;
        }
        
        // Skip closing quote if found
        if (i < original.length && original[i] === '"') {
          i++;
        }
        
        // Don't increment staticPosCount for quoted content
        continue;
        } else {
        // Regular character - check if this is the position we're looking for
        if (staticPosCount === staticPos) {
          return i;
        }
        staticPosCount++;
      }
    }
    
    // If we've reached the end, return the last position
    return original.length - 1;
  }

  /**
   * Replace only parameter-delimiting quotes with markers
   * Keeps quotes inside parameters (like XPath/CSS) unchanged
   * Example: "//div[@class="error"]" → ●//div[@class="error"]●
   */
  private static replaceQuotesWithMarkers(step: string): string {
    const result: string[] = [];
    let i = 0;
    
    while (i < step.length) {
      if (step[i] === '"') {
        // This is a potential opening quote - replace with marker
        result.push('●');
        i++;
        
        // Find the matching closing quote, tracking bracket depth for XPath/CSS
        let bracketDepth = 0;
        let foundClosing = false;
        
        while (i < step.length) {
          const char = step[i];
          
          // Track bracket depth
          if (char === '[') {
            bracketDepth++;
            result.push(char);
            i++;
            continue;
          } else if (char === ']') {
            bracketDepth--;
            result.push(char);
            i++;
            continue;
          }
          
          // If we're inside brackets, keep all quotes as-is (they're part of XPath/CSS)
          if (bracketDepth > 0 && char === '"') {
            result.push('"');
            i++;
            continue;
          }
          
          // Check if this is the closing delimiter quote (not inside brackets)
          if (char === '"' && bracketDepth === 0) {
            // Before treating this as closing quote, verify it's not a new parameter opening
            // Check what comes before this quote - if it's a keyword, this is likely a new opening
            const beforeQuote = result.slice(-20).join('').toLowerCase(); // Last 20 chars before quote
            
            // Keywords that typically come before a new parameter, not inside one
            const newParamKeywords = [
              ' times ', 'starting at ', ' at ', ' on ', 'on element ',
              ' contains ', 'property ', ' in ', ' to ', ' with ', ' for ', ' if '
            ];
            
            let looksLikeNewOpening = false;
            for (const keyword of newParamKeywords) {
              if (beforeQuote.endsWith(keyword.toLowerCase())) {
                looksLikeNewOpening = true;
                console.log(`⚠️ Detected new parameter after keyword "${keyword}" - adding missing closing quote`);
                break;
              }
            }
            
            if (looksLikeNewOpening) {
              // This is a new parameter opening, not our closing quote
              // Just break without adding marker - the closing quote is missing
              // Don't increment i, let the outer loop handle this as new opening quote
              console.log('  → Breaking to let outer loop process this as new opening');
              foundClosing = false; // Mark as not found so we add marker after loop
              break;
            } else {
              // This is the closing quote - replace with marker
              result.push('●');
              i++;
              foundClosing = true;
              break;
            }
          }
          
          // Regular character inside parameter
          result.push(char);
          i++;
        }
        
        // If we didn't find a closing quote, the rest of the string is the parameter content
        // Don't add a closing marker - let the comparison algorithm detect the missing quote
        if (!foundClosing) {
          // Continue without adding closing marker
          console.log('⚠️ No closing quote found in replaceQuotesWithMarkers');
        }
      } else {
        result.push(step[i]);
        i++;
      }
    }
    
    return result.join('');
  }

  /**
   * Validate steps against actions and return detailed error info when invalid
   */
  static StepAction(control: AbstractControl): ValidationErrors | null {
    try {
        const _this = this as any;
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

      // Use marker-based approach for better comparison with nested quotes
      const MARKER = '●';
      const userWithMarkers = CustomValidators.replaceQuotesWithMarkers(value);
      // Replace both complete (●...●) and incomplete (●...) parameters with ●●
      const userClean = userWithMarkers
        .replace(/●[^●]*●/g, '●●')        // Complete parameters: ●content●
        .replace(/●[^●]+/g, '●●')         // Incomplete parameters: ●content (no closing)
        .toLowerCase();
      
      let minDistance = Number.POSITIVE_INFINITY;
      let bestOriginal = '';
      let bestDistance = Number.POSITIVE_INFINITY;

      console.log('🔍 Finding closest match for:', value);
      console.log('  User with markers:', userWithMarkers);
      console.log('  User clean (params removed):', userClean);

      for (const a of actions) {
        let name = a.action_name?.trim() ?? '';
        name = name.replace(/^(then|when|given|and)\s+/i, '');
        
        const actionWithMarkers = CustomValidators.replaceQuotesWithMarkers(name);
        const clean = actionWithMarkers
          .replace(/●[^●]*●/g, '●●')        // Complete parameters
          .replace(/●[^●]+/g, '●●')         // Incomplete parameters
          .toLowerCase();
        
        // Calculate distance on cleaned versions (static text only)
        let d = CustomValidators.levenshteinDistance(userClean, clean);
        
        // Store best match info for debugging
        if (d < bestDistance) {
          bestDistance = d;
          console.log(`  ✨ New best match: "${name}" (distance: ${d})`);
        }
        
        if (d < minDistance) {
          minDistance = d;
          bestOriginal = name;
        }
      }

      console.log(`  🎯 Final best match: "${bestOriginal}" (distance: ${minDistance})`);

      // Balanced threshold - allow 25% difference
      // For a 20-char step, allow max 5 chars different
      // For a 40-char step, allow max 10 chars different
      // Min threshold of 3 to handle very short steps
      const maxAllowedDistance = Math.max(3, Math.floor(userClean.length * 0.99));
      const isSimilarEnough = isFinite(minDistance) && minDistance <= maxAllowedDistance;
      
      console.log(`  📊 Distance: ${minDistance}, Max allowed: ${maxAllowedDistance}, Similar enough: ${isSimilarEnough}`);
      
      let suggestion = 'No similar step found';
      let closestMatch: string | null = null;
      
      if (bestOriginal && isSimilarEnough) {
        // Use the new error comparison function that preserves quoted parts for better context
        const diff = CustomValidators.findFirstDifferenceForError(value, bestOriginal);
        if (diff) {
          suggestion = `Character at position ${diff.index + 1}: found '${diff.userChar || '∅'}', expected '${diff.expectedChar || '∅'}'`;
        } else {
          // No specific character difference found - just show generic message
          suggestion = 'Step definition does not match any known pattern';
        }
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
