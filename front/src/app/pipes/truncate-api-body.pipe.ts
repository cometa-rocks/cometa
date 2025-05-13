import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'truncateApiBody',
  standalone: true
})
export class TruncateApiBodyPipe implements PipeTransform {
  transform(value: string): string {
    if (!value) return value;
    
    // Find the body part
    const bodyMatch = value.match(/body:(\{[\s\S]*?\})"/);
    if (!bodyMatch) return value;

    // Create a shortened version of the body
    const body = bodyMatch[1];
    try {
      const jsonObj = JSON.parse(body);
      if (typeof jsonObj === 'object' && Object.keys(jsonObj).length > 3) {
        const shortened = Object.entries(jsonObj)
          .slice(0, 3)
          .reduce((acc, [key, value]) => {
            acc[key] = value;
            return acc;
          }, {} as any);
        shortened['...'] = '...';
        const shortenedBody = JSON.stringify(shortened);
        return value.replace(body, shortenedBody);
      }
    } catch (e) {
      // If parsing fails, just return the original content
      return value;
    }
    return value;
  }
} 