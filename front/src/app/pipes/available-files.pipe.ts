import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'availableFiles',
  standalone: true,
})
export class AvailableFilesPipe implements PipeTransform {
  transform(files, fileType?: string): any[] {
    if (!files) return [];
    
    // First filter out removed files
    let availableFiles = files.filter(f => !f.is_removed);
    
    // Then apply file_type filter if specified
    if (fileType) {
      availableFiles = availableFiles.filter(f => f.file_type === fileType);
    }
    
    return availableFiles;
  }
}
