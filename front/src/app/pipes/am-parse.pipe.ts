import { Pipe, PipeTransform } from '@angular/core';
import { isValid, parse, parseISO } from 'date-fns';

@Pipe({
  name: 'amParse',
})
export class AmParsePipe implements PipeTransform {
  formats = ["yyyy-MM-dd'T'HH:mm:ss", "yyyy-MM-dd'T'HH:mm:ss.SSSS"];

  transform(value: string): Date {
    // Correct datetime yyyy-MM-dd'T'HH:mm:ss contains 19 characters
    // We cut it if it contains more numbers because some dates also
    // contains microseconds, which is not supported in date-fns
    // Update: Datetime with Z UTC value contains 20 characters
    value = `${value}`;
    // Try to parse as ISO
    const iso = parseISO(value);
    if (isValid(iso)) {
      return iso;
    }
    // Try to parse as UTC
    if (value.length > 20) {
      value = value.substring(0, 20);
    }
    return this.parseMultiple(value, this.formats, new Date());
  }

  /**
   * Same as date-fns parse() but allows for multiple parsing formats
   * @param {string} dateString
   * @param {string|string[]} formatString
   * @param {number|Date} referenceDate
   * @param {any} options
   * @returns {Date}
   */
  parseMultiple(
    dateString: string,
    formatString: string | string[],
    referenceDate: number | Date,
    options?
  ) {
    let result;
    // Check if formatString is an array
    if (Array.isArray(formatString)) {
      for (let i = 0; i < formatString.length; i++) {
        // Check every parsing format in array
        result = this.parseDate(dateString, formatString[i]);
        // Check is valid
        if (isValid(result)) {
          break;
        }
      }
    } else {
      // Parse as usual if formatString is a string
      result = parse(dateString, formatString, referenceDate, options);
    }
    return result;
  }

  parseDate(dateString: string, format: string) {
    // Check for UTC dates and calculate offset
    if (dateString.substr(dateString.length - 1) === 'Z') {
      const dateNoUTC = dateString.substring(0, 19);
      const parsed = parse(`${dateNoUTC} +00`, `${format} x`, new Date());
      return parsed;
    }
    return parse(dateString, format, new Date());
  }

  /**
   * Automatically converts the UTC date to local time offset
   * @param date Date
   * 
  formatTimezone(date: Date): Date {
    const offset = date.getTimezoneOffset();
    return Math.sign(offset) !== -1 ? addMinutes(date, offset) : subMinutes(date, Math.abs(offset));
  }
   */
}
