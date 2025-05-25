import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'truncateApiBody',
  standalone: true
})
export class TruncateApiBodyPipe implements PipeTransform {
  transform(value: string): string {
    if (!value) return value;
    
    // Find the body part - now handles both JSON and XML
    const bodyMatch = value.match(/body:(\{[\s\S]*?\}|<[\s\S]*?>)"/);
    if (!bodyMatch) return value;

    // Create a shortened version of the body
    const body = bodyMatch[1];
    
    // Check if it's XML
    if (body.trim().startsWith('<')) {
      try {
        // Count the number of top-level elements
        const topLevelElements = body.match(/<[^/][^>]*>/g) || [];
        if (topLevelElements.length > 3) {
          // Keep only the first 3 elements and add a truncation indicator
          const shortened = body.split(/<\/[^>]*>/)
            .slice(0, 3)
            .join('</>') + '...';
          return value.replace(body, shortened);
        }
      } catch (e) {
        // If parsing fails, just return the original content
        return value;
      }
    } 
    // Handle JSON
    else {
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
    }
    return value;
  }
} 