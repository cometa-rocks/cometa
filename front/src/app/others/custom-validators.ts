import { AbstractControl, ValidationErrors } from '@angular/forms';

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
    const firstQuoteIndex = step.indexOf('"');
    
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
    const lastQuoteIndex = step.lastIndexOf('"');
    const beforeQuotes = step.substring(0, firstQuoteIndex);
    const afterQuotes = step.substring(lastQuoteIndex + 1);
    
    return beforeQuotes + afterQuotes;
  }

  /**
   * Extract static and dynamic ranges from a step
   * Static = text outside quotes + quotes themselves  
   * Dynamic = content inside quotes
   * Smart pairing: skips quotes that are inside XML/HTML attributes
   */
  static extractStepRanges(step: string): { staticRanges: {start: number, end: number}[], dynamicRanges: {start: number, end: number}[] } {
    const staticRanges: {start: number, end: number}[] = [];
    const dynamicRanges: {start: number, end: number}[] = [];
    
    let i = 0;
    let lastEnd = 0;
    
    while (i < step.length) {
      if (step[i] === '"') {
        const openQuote = i;
        
        // Add static range before opening quote
        if (openQuote > lastEnd) {
          staticRanges.push({
            start: lastEnd,
            end: openQuote
          });
        }
        
        // Add opening quote as static
        staticRanges.push({
          start: openQuote,
          end: openQuote + 1
        });
        
        // Find closing quote, skipping quotes inside XML/HTML attributes
        let j = openQuote + 1;
        let foundClose = false;
        let insideAttributeValue = false;
        
        while (j < step.length) {
          // Check if we're entering an attribute value: [@attr="
          if (j >= 2 && step[j] === '"' && step[j - 1] === '=' && 
              step.substring(Math.max(0, j - 10), j).includes('[')) {
            // Entering attribute value, skip until we find "]
            insideAttributeValue = true;
            j++;
            continue;
          }
          
          // Check if we're exiting an attribute value: "]
          if (insideAttributeValue && j >= 1 && step[j] === '"' && j + 1 < step.length && step[j + 1] === ']') {
            // Exiting attribute value
            insideAttributeValue = false;
            j++;
            continue;
          }
          
          if (step[j] === '"' && !insideAttributeValue) {
            // This is the closing quote
            foundClose = true;
            break;
          }
          j++;
        }
        
        const closeQuote = foundClose ? j : step.length - 1;
        
        // Add dynamic range (content between quotes)
        if (closeQuote > openQuote + 1) {
          dynamicRanges.push({
            start: openQuote + 1,
            end: closeQuote
          });
        }
        
        // Add closing quote as static
        if (foundClose) {
          staticRanges.push({
            start: closeQuote,
            end: closeQuote + 1
          });
          lastEnd = closeQuote + 1;
          i = closeQuote + 1;
        } else {
          lastEnd = step.length;
          i = step.length;
        }
      } else {
        i++;
      }
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
   * Compare user input with correct step and return detailed character-by-character info
   * Shows which characters are missing in the static parts (ignores dynamic content like "{url}")
   */
  static compareStepsForOverlay(userInput: string, correctStep: string): { char: string; isMissing: boolean }[] {
    if (!userInput || !correctStep) return [];
    
    // Step 1: Replace quotes with a special marker to simplify parsing
    const QUOTE_MARKER = '●'; // Special character that won't appear in normal steps
    const correctWithMarkers = CustomValidators.replaceQuotesWithMarkers(correctStep);
    const userWithMarkers = CustomValidators.replaceQuotesWithMarkers(userInput);
    
    console.log('🔍 Original correct:', correctStep);
    console.log('🔍 With markers:', correctWithMarkers);
    console.log('🔍 User input:', userInput);
    console.log('🔍 User with markers:', userWithMarkers);
    
    // Step 2: Extract what parts are static (text) vs dynamic (parameters between markers)
    const { staticRanges, dynamicRanges } = CustomValidators.extractStepRangesWithMarkers(correctWithMarkers, QUOTE_MARKER);
    const staticParts = staticRanges.map(range => ({
      text: correctWithMarkers.substring(range.start, range.end),
      position: range.start
    }));
    
    // Debug: log ranges for multi-parameter steps
    if (dynamicRanges.length > 1) {
      console.log('🔍 Multi-parameter step detected');
      console.log('  Static parts:', staticParts.map(p => `"${p.text}" at ${p.position}`));
      console.log('  Dynamic ranges:', dynamicRanges.map(r => `[${r.start}-${r.end}]: "${correctWithMarkers.substring(r.start, r.end)}"`));
    }
    
    // Step 3: Find which characters are missing
    const missingPositions = CustomValidators.findMissingCharactersWithMarkers(userWithMarkers, correctWithMarkers, staticParts, QUOTE_MARKER);
    
    // Step 4: Build result - mark each character as missing or not
    return CustomValidators.buildCharacterArray(correctStep, dynamicRanges, missingPositions);
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
            // This is the closing quote - replace with marker
            result.push('●');
            i++;
            foundClosing = true;
            break;
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
   * Extract static and dynamic ranges using marker character
   * Much simpler than parsing nested quotes
   */
  private static extractStepRangesWithMarkers(step: string, marker: string): { staticRanges: {start: number, end: number}[], dynamicRanges: {start: number, end: number}[] } {
    const staticRanges: {start: number, end: number}[] = [];
    const dynamicRanges: {start: number, end: number}[] = [];
    
    let i = 0;
    let lastEnd = 0;
    
    while (i < step.length) {
      if (step[i] === marker) {
        const openMarker = i;
        
        // Add static range before opening marker (including the marker itself)
        if (openMarker >= lastEnd) {
          staticRanges.push({
            start: lastEnd,
            end: openMarker + 1  // Include the marker
          });
        }
        
        // Find closing marker
        let j = openMarker + 1;
        while (j < step.length && step[j] !== marker) {
          j++;
        }
        
        if (j < step.length) {
          // Found closing marker
          // Add dynamic range (content between markers)
          if (j > openMarker + 1) {
            dynamicRanges.push({
              start: openMarker + 1,
              end: j
            });
          }
          
          // Add closing marker to static
          staticRanges.push({
            start: j,
            end: j + 1
          });
          
          lastEnd = j + 1;
          i = j + 1;
        } else {
          // No closing marker found, rest is dynamic
          if (step.length > openMarker + 1) {
            dynamicRanges.push({
              start: openMarker + 1,
              end: step.length
            });
          }
          lastEnd = step.length;
          i = step.length;
        }
      } else {
        i++;
      }
    }
    
    // Add final static range after last marker
    if (lastEnd < step.length) {
      staticRanges.push({
        start: lastEnd,
        end: step.length
      });
    }
    
    return { staticRanges, dynamicRanges };
  }

  /**
   * Find missing characters using marker-based approach
   */
  private static findMissingCharactersWithMarkers(
    userInput: string,
    correctStep: string,
    staticParts: { text: string; position: number }[],
    marker: string
  ): Set<number> {
    const missing = new Set<number>();
    let searchPosition = 0;
    
    console.log('  📝 Text parts to search:', staticParts.map(p => `"${p.text}" at ${p.position}`));
    
    for (let partIdx = 0; partIdx < staticParts.length; partIdx++) {
      const part = staticParts[partIdx];
      console.log(`  🔍 Searching for "${part.text}" from position ${searchPosition}`);
      
      // If this part is just a marker, we need to find it after skipping the parameter content
      if (part.text === marker) {
        // Look for next marker from current position
        const nextMarkerPos = userInput.indexOf(marker, searchPosition);
        if (nextMarkerPos !== -1) {
          console.log(`  ✅ Found marker at position ${nextMarkerPos}`);
          searchPosition = nextMarkerPos + 1; // Move past the marker
        } else {
          console.log(`  ⚠️ Marker not found, marking position ${part.position} as missing`);
          missing.add(part.position);
          
          // Try to resync by finding the next text part
          const nextTextPart = staticParts.slice(partIdx + 1).find(p => p.text !== marker);
          if (nextTextPart) {
            console.log(`  🔄 Trying to resync by finding next text: "${nextTextPart.text}"`);
            const resyncPos = userInput.indexOf(nextTextPart.text, searchPosition);
            if (resyncPos !== -1) {
              console.log(`  ✅ Resynced at position ${resyncPos}`);
              searchPosition = resyncPos;
            }
          }
        }
      } else {
        searchPosition = CustomValidators.checkTextMissing(userInput, part, searchPosition, missing);
      }
      
      console.log(`  ➡️ After search, searchPosition = ${searchPosition}`);
    }
    
    return missing;
  }

  /**
   * Find all missing character positions by searching for static parts in user input
   * Simplified approach: only look for non-quote static text, ignore quote parsing
   */
  private static findMissingCharacters(
    userInput: string, 
    correctStep: string, 
    staticParts: { text: string; position: number }[]
  ): Set<number> {
    const missing = new Set<number>();
    let searchPosition = 0;
    
    // Filter out quote parts - we only care about text between parameters
    const textParts = staticParts.filter(p => p.text !== '"');
    
    console.log('  📝 Text parts to search:', textParts.map(p => `"${p.text}" at ${p.position}`));
    
    for (const part of textParts) {
      console.log(`  🔍 Searching for "${part.text}" from position ${searchPosition}`);
      
      // Skip any quoted content before searching for this text part
      searchPosition = CustomValidators.skipQuotedContent(userInput, searchPosition);
      console.log(`  📌 After skipping quotes, searchPosition = ${searchPosition}`);
      
      searchPosition = CustomValidators.checkTextMissing(userInput, part, searchPosition, missing);
      console.log(`  ➡️ After search, searchPosition = ${searchPosition}`);
    }
    
    // Now check quotes separately - compare count and mark if different
    const correctQuoteCount = CustomValidators.countQuotes(correctStep);
    const userQuoteCount = CustomValidators.countQuotes(userInput);
    
    if (correctQuoteCount !== userQuoteCount) {
      console.log(`  ⚠️ Quote count mismatch: correct=${correctQuoteCount}, user=${userQuoteCount}`);
      
      // Find all quote positions in correctStep
      const quotePositions: number[] = [];
      for (let i = 0; i < correctStep.length; i++) {
        if (correctStep[i] === '"') {
          quotePositions.push(i);
        }
      }
      
      // Mark missing quotes based on count difference
      const missingQuoteCount = Math.abs(correctQuoteCount - userQuoteCount);
      if (correctQuoteCount > userQuoteCount) {
        // User has fewer quotes - mark the last N quotes as missing
        for (let i = quotePositions.length - missingQuoteCount; i < quotePositions.length; i++) {
          missing.add(quotePositions[i]);
        }
      }
    }
    
    return missing;
  }


  /**
   * Skip quoted content in userInput starting from a position
   * Handles nested quotes like [@class="error"]
   * If closing quote is missing, only skip a reasonable amount (whitespace/word boundary)
   */
  private static skipQuotedContent(userInput: string, startPos: number): number {
    let pos = startPos;
    
    // Skip any quotes we encounter
    while (pos < userInput.length && userInput[pos] === '"') {
      const openQuotePos = pos;
      pos++; // Skip opening quote
      let insideAttributeValue = false;
      let foundClosing = false;
      const maxSkip = 200; // Safety limit to avoid skipping too much
      
      while (pos < userInput.length && pos - openQuotePos < maxSkip) {
        // Check if entering attribute value: [@attr="
        if (pos >= 2 && userInput[pos] === '"' && userInput[pos - 1] === '=' && 
            userInput.substring(Math.max(0, pos - 10), pos).includes('[')) {
          insideAttributeValue = true;
          pos++;
          continue;
        }
        
        // Check if exiting attribute value: "]
        if (insideAttributeValue && pos >= 1 && userInput[pos] === '"' && pos + 1 < userInput.length && userInput[pos + 1] === ']') {
          insideAttributeValue = false;
          pos++;
          continue;
        }
        
        // Found closing quote (not inside attribute)
        if (userInput[pos] === '"' && !insideAttributeValue) {
          pos++; // Skip closing quote
          foundClosing = true;
          break;
        }
        pos++;
      }
      
      // If closing quote wasn't found, return to position after opening quote
      // This allows the search algorithm to continue from there
      if (!foundClosing) {
        console.log(`  ⚠️ Closing quote not found, returning to position after opening quote: ${openQuotePos + 1}`);
        return openQuotePos + 1;
      }
    }
    
    return pos;
  }

  /**
   * Check if text is missing in user input by comparing character by character
   * Uses conservative matching with very short lookahead to avoid false positives
   */
  private static checkTextMissing(
    userInput: string,
    part: { text: string; position: number },
    searchFrom: number,
    missing: Set<number>
  ): number {
    const localMissing: number[] = []; // Track only missing positions for this part
    console.log('🔍 checkTextMissing:', part.text, '| userInput:', userInput.substring(searchFrom));
    
    const foundAt = userInput.indexOf(part.text, searchFrom);
    
    // Found exact match nearby? Continue from there
    if (foundAt !== -1 && foundAt - searchFrom <= 20) {
      console.log('✅ Exact match found at:', foundAt);
      return foundAt + part.text.length;
    }
    
    // Use word-aware matching to detect missing chars without desync
    const expected = part.text;
    let userIndex = searchFrom;
    let expectedIndex = 0;
    
    while (expectedIndex < expected.length && userIndex < userInput.length) {
      // Check if current characters match
      if (expected[expectedIndex] === userInput[userIndex]) {
        // Direct match, advance both
        userIndex++;
        expectedIndex++;
      } else {
        // No match - try to resynchronize by finding next matching sequence
        // Look for at least 3 consecutive matching chars to avoid false positives
        let foundSync = false;
        const minSyncLength = 3;
        
        // Try to find a resync point within next 10 chars of expected
        for (let skipExpected = 1; skipExpected <= 10 && expectedIndex + skipExpected < expected.length; skipExpected++) {
          // Check if we can find a sequence of minSyncLength matching chars
          let matchCount = 0;
          for (let checkIdx = 0; checkIdx < minSyncLength && 
               expectedIndex + skipExpected + checkIdx < expected.length && 
               userIndex + checkIdx < userInput.length; checkIdx++) {
            if (expected[expectedIndex + skipExpected + checkIdx] === userInput[userIndex + checkIdx]) {
              matchCount++;
            } else {
              break;
            }
          }
          
          if (matchCount === minSyncLength) {
            // Found a good resync point - mark skipped chars as missing
            for (let i = 0; i < skipExpected; i++) {
              missing.add(part.position + expectedIndex + i);
              localMissing.push(part.position + expectedIndex + i);
            }
            expectedIndex += skipExpected;
            foundSync = true;
            break;
          }
        }
        
        if (!foundSync) {
          // Couldn't resync - just mark current as missing and try next
          missing.add(part.position + expectedIndex);
          localMissing.push(part.position + expectedIndex);
          expectedIndex++;
        }
      }
    }
    
    // If we didn't match all expected characters, mark the rest as missing
    while (expectedIndex < expected.length) {
      missing.add(part.position + expectedIndex);
      localMissing.push(part.position + expectedIndex);
      expectedIndex++;
    }
    
    if (localMissing.length > 0) {
      console.log('⚠️ Missing positions in this part:', localMissing);
    }
    
    // Return current position in user input
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
      const userClean = userWithMarkers.replace(/●[^●]*●/g, '●●').toLowerCase(); // Replace parameters with ●●
      
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
        const clean = actionWithMarkers.replace(/●[^●]*●/g, '●●').toLowerCase();
        
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
