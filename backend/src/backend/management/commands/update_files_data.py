from django.core.management.base import BaseCommand
from backend.models import File, FileData
from backend.utility.uploadFile import getFileContent, decryptFile
import pandas as pd
import os
import tempfile
from django.db import transaction

class Command(BaseCommand):
    help = 'Lists all File objects and their data from the database, validates file types and updates metadata'
    
    def add_arguments(self, parser):
        parser.add_argument(
            '--test',
            action='store_true',
            help='Show what changes would be made without actually saving them',
        )

    def validate_and_update_file(self, file_obj, test_mode=False):
        """Validate file type and update file metadata in the database"""
        try:
            # Skip if file doesn't exist
            if not file_obj.path or not os.path.exists(file_obj.path):
                self.stdout.write(self.style.WARNING(f"  File not found on disk: {file_obj.path}"))
                return False
            
            # Start transaction - all DB updates will be atomic
            with transaction.atomic():
                # Check file extension
                file_name_lower = file_obj.name.lower()
                is_excel = file_name_lower.endswith(('.xls', '.xlsx'))
                is_csv = file_name_lower.endswith('.csv')
                
                # Set initial file type based on extension
                if not is_excel and not is_csv:
                    if file_obj.file_type != 'normal':
                        if test_mode:
                            self.stdout.write(self.style.SUCCESS(f"  [TEST MODE] Would update file_type to 'normal' (not Excel/CSV)"))
                        else:
                            file_obj.file_type = 'normal'
                            file_obj.save(update_fields=['file_type'])
                            self.stdout.write(self.style.SUCCESS(f"  Updated file_type to 'normal' (not Excel/CSV)"))
                    return True
                
                # For Excel/CSV files, we need to check content
                temp_file_path = None
                try:
                    # Decrypt the file
                    self.stdout.write(self.style.SUCCESS(f"  Reading file directly: {file_obj.path}"))
                    temp_file_path = decryptFile(file_obj.path)
                    
                    # Read the file based on type
                    if is_csv:
                        # Try different encodings for CSV
                        encodings = ['utf-8', 'latin1', 'iso-8859-1', 'cp1252']
                        df = None
                        for encoding in encodings:
                            try:
                                df = pd.read_csv(temp_file_path, encoding=encoding)
                                break  # If successful, exit the loop
                            except UnicodeDecodeError:
                                continue
                        
                        if df is None:
                            self.stdout.write(self.style.WARNING("  Could not decode CSV with any encoding"))
                            return False
                        
                        # Normalize column names
                        df.columns = df.columns.str.replace(" ", "_").str.lower()
                        columns = list(df.columns)
                        
                        # Check if it's a datadriven file
                        has_feature_id = 'feature_id' in columns
                        has_feature_name = 'feature_name' in columns
                        
                        # Update file_type if needed
                        if has_feature_id or has_feature_name:
                            if file_obj.file_type != 'datadriven':
                                if test_mode:
                                    self.stdout.write(self.style.SUCCESS(f"  [TEST MODE] Would update file_type to 'datadriven' (found feature columns)"))
                                else:
                                    file_obj.file_type = 'datadriven'
                                    self.stdout.write(self.style.SUCCESS(f"  Updated file_type to 'datadriven' (found feature columns)"))
                            # No update needed for sheet_names for CSV
                        else:
                            if file_obj.file_type != 'normal':
                                if test_mode:
                                    self.stdout.write(self.style.SUCCESS(f"  [TEST MODE] Would update file_type to 'normal' (no feature columns)"))
                                else:
                                    file_obj.file_type = 'normal'
                                    self.stdout.write(self.style.SUCCESS(f"  Updated file_type to 'normal' (no feature columns)"))
                        
                        # Save changes
                        if not test_mode:
                            file_obj.save(update_fields=['file_type'])
                    
                    elif is_excel:
                        # Read Excel file
                        xls = pd.ExcelFile(temp_file_path)
                        sheet_names = xls.sheet_names
                        
                        # Update sheet_names in database
                        if file_obj.sheet_names != sheet_names:
                            if test_mode:
                                self.stdout.write(self.style.SUCCESS(f"  [TEST MODE] Would update sheet_names: {sheet_names}"))
                            else:
                                file_obj.sheet_names = sheet_names
                                self.stdout.write(self.style.SUCCESS(f"  Updated sheet_names: {sheet_names}"))
                        
                        # Check first sheet for feature columns
                        if sheet_names:
                            first_sheet = sheet_names[0]
                            df = pd.read_excel(xls, sheet_name=first_sheet)
                            
                            # Normalize column names
                            df.columns = df.columns.str.replace(" ", "_").str.lower()
                            columns = list(df.columns)
                            
                            # Check if it's a datadriven file
                            has_feature_id = 'feature_id' in columns
                            has_feature_name = 'feature_name' in columns
                            
                            # Update file_type if needed
                            if has_feature_id or has_feature_name:
                                if file_obj.file_type != 'datadriven':
                                    if test_mode:
                                        self.stdout.write(self.style.SUCCESS(f"  [TEST MODE] Would update file_type to 'datadriven' (found feature columns)"))
                                    else:
                                        file_obj.file_type = 'datadriven'
                                        self.stdout.write(self.style.SUCCESS(f"  Updated file_type to 'datadriven' (found feature columns)"))
                            else:
                                if file_obj.file_type != 'normal':
                                    if test_mode:
                                        self.stdout.write(self.style.SUCCESS(f"  [TEST MODE] Would update file_type to 'normal' (no feature columns)"))
                                    else:
                                        file_obj.file_type = 'normal'
                                        self.stdout.write(self.style.SUCCESS(f"  Updated file_type to 'normal' (no feature columns)"))
                        
                        # Save changes
                        if not test_mode:
                            file_obj.save(update_fields=['file_type', 'sheet_names'])
                    
                    return True
                    
                except Exception as e:
                    self.stdout.write(self.style.ERROR(f"  Error processing file: {str(e)}"))
                    # Transaction will be rolled back if any exception occurs
                    raise
                finally:
                    # Clean up temp file
                    if temp_file_path and os.path.exists(temp_file_path):
                        try:
                            os.remove(temp_file_path)
                        except Exception as e:
                            self.stdout.write(self.style.WARNING(f"  Warning: Could not remove temp file: {str(e)}"))
        
        except Exception as e:
            self.stdout.write(self.style.ERROR(f"  Transaction failed: {str(e)}"))
            return False
            
        return True

    def get_file_columns(self, file_obj):
        """Get column information directly from the file first, fallback to database if needed"""
        try:
            # First try to read directly from the file
            if file_obj.path and os.path.exists(file_obj.path):
                # Decrypt the file first (temporary file)
                temp_file_path = None
                try:
                    self.stdout.write(self.style.SUCCESS(f"  Reading file directly from: {file_obj.path}"))
                    temp_file_path = decryptFile(file_obj.path)
                    
                    # Check file type to determine how to read it
                    if file_obj.name.lower().endswith('.csv'):
                        # Try different encodings for CSV
                        encodings = ['utf-8', 'latin1', 'iso-8859-1', 'cp1252']
                        for encoding in encodings:
                            try:
                                df = pd.read_csv(temp_file_path, nrows=5, encoding=encoding)
                                return {
                                    'columns': list(df.columns),
                                    'sample_data': df.head().to_dict('records'),
                                    'source': 'file'
                                }
                            except UnicodeDecodeError:
                                continue
                        return {'error': "Could not decode CSV file with any of the attempted encodings"}
                        
                    elif file_obj.name.lower().endswith(('.xls', '.xlsx')):
                        # For Excel files, get all sheets
                        sheets_data = {}
                        
                        # Read all sheets
                        xls = pd.ExcelFile(temp_file_path)
                        sheet_names = xls.sheet_names
                        
                        self.stdout.write(self.style.SUCCESS(f"  File has {len(sheet_names)} sheets: {sheet_names}"))
                        
                        for sheet_name in sheet_names:
                            try:
                                df = pd.read_excel(xls, sheet_name=sheet_name, nrows=5)
                                sheets_data[sheet_name] = {
                                    'columns': list(df.columns),
                                    'sample_data': df.head().to_dict('records')
                                }
                            except Exception as e:
                                sheets_data[sheet_name] = {'error': str(e)}
                        
                        return {'sheets': sheets_data, 'sheet_names': sheet_names, 'source': 'file'}
                    else:
                        return {'error': "Unsupported file format"}
                except Exception as e:
                    self.stdout.write(self.style.WARNING(f"  Error reading from file: {str(e)}"))
                    # Continue to try database methods next
                finally:
                    # Clean up temp file
                    if temp_file_path and os.path.exists(temp_file_path):
                        try:
                            os.remove(temp_file_path)
                        except Exception as e:
                            self.stdout.write(self.style.WARNING(f"  Warning: Could not remove temp file: {str(e)}"))
            
            # If direct file read fails, try to get from FileData records
            file_data_count = FileData.objects.filter(file=file_obj).count()
            if file_data_count > 0:
                self.stdout.write(self.style.WARNING(f"  FALLBACK: Using data from database ({file_data_count} rows)"))
                
                # Sample a few records to show data
                sample_data = FileData.objects.filter(file=file_obj)[:5]
                if sample_data:
                    first_data = sample_data[0].data
                    if isinstance(first_data, dict):
                        return {
                            'columns': list(first_data.keys()),
                            'source': 'database_filedata'
                        }
            
            # If all else fails, use column_order from the file object
            if file_obj.column_order:
                self.stdout.write(self.style.WARNING(f"  FALLBACK: Using column_order from database"))
                return {
                    'columns': file_obj.column_order,
                    'source': 'database_file_model'
                }
                
            return {'error': "No column information available"}
            
        except Exception as e:
            return {'error': f"Error: {str(e)}"}

    def handle(self, *args, **options):
        test_mode = options.get('test', False)
        
        if test_mode:
            self.stdout.write(self.style.WARNING('Running in TEST MODE - no changes will be saved to the database'))
        else:
            self.stdout.write(self.style.SUCCESS('Starting to validate and update all files...'))
        
        all_files = File.objects.all()
        
        if not all_files:
            self.stdout.write(self.style.WARNING('No files found in the database.'))
            return

        updated_count = 0
        failed_count = 0

        for file_obj in all_files:
            self.stdout.write(self.style.HTTP_INFO(f'File ID: {file_obj.id}'))
            self.stdout.write(f'  Name: {file_obj.name}')
            self.stdout.write(f'  Path: {file_obj.path}')
            self.stdout.write(f'  Upload Path: {file_obj.uploadPath}')
            self.stdout.write(f'  Size: {file_obj.size}')
            self.stdout.write(f'  Type: {file_obj.type}')
            self.stdout.write(f'  MIME Type: {file_obj.mime}')
            self.stdout.write(f'  MD5 Sum: {file_obj.md5sum}')
            self.stdout.write(f'  Department: {file_obj.department.department_name if file_obj.department else "N/A"}')
            self.stdout.write(f'  Status: {file_obj.status}')
            self.stdout.write(f'  File Type: {file_obj.file_type}')
            self.stdout.write(f'  Uploaded By: {file_obj.uploaded_by.name if file_obj.uploaded_by else "N/A"}')
            self.stdout.write(f'  Created On: {file_obj.created_on}')
            self.stdout.write(f'  Is Removed: {file_obj.is_removed}')
            self.stdout.write(f'  Extras: {file_obj.extras}')
            
            # Show database values, but mark them as from database
            if file_obj.column_order:
                self.stdout.write(f'  Column Order (from db): {file_obj.column_order}')
            if file_obj.sheet_names:
                self.stdout.write(f'  Sheet Names (from db): {file_obj.sheet_names}')
            
            # Validate and update file metadata
            if self.validate_and_update_file(file_obj, test_mode):
                updated_count += 1
            else:
                failed_count += 1
            
            # Try to get column information directly from file
            columns_info = self.get_file_columns(file_obj)
            
            if 'error' in columns_info:
                self.stdout.write(self.style.WARNING(f'  Column Info Error: {columns_info["error"]}'))
            elif 'source' in columns_info:
                source = columns_info['source']
                if 'columns' in columns_info:
                    self.stdout.write(self.style.SUCCESS(f'  Columns (from {source}): {columns_info["columns"]}'))
                    if 'sample_data' in columns_info and columns_info['sample_data']:
                        self.stdout.write(self.style.SUCCESS(f'  Sample Data (first row): {columns_info["sample_data"][0]}'))
                elif 'sheets' in columns_info:
                    self.stdout.write(self.style.SUCCESS(f'  Excel File with {len(columns_info["sheet_names"])} sheets (from {source}):'))
                    for sheet_name, sheet_data in columns_info['sheets'].items():
                        if 'error' in sheet_data:
                            self.stdout.write(f'    - Sheet "{sheet_name}": Error: {sheet_data["error"]}')
                        else:
                            self.stdout.write(f'    - Sheet "{sheet_name}": Columns: {sheet_data["columns"]}')
                            if sheet_data['sample_data']:
                                self.stdout.write(f'      Sample Data (first row): {sheet_data["sample_data"][0]}')
            
            # Get updated file record to show current values
            if not test_mode:
                file_obj.refresh_from_db()
            
            self.stdout.write(self.style.SUCCESS(f'  Current file_type: {file_obj.file_type}'))
            self.stdout.write(self.style.SUCCESS(f'  Current sheet_names: {file_obj.sheet_names}'))
            
            self.stdout.write('---')
            
        self.stdout.write(self.style.SUCCESS(
            f'{"[TEST MODE] Would process" if test_mode else "Successfully processed"} {all_files.count()} file(s). '
            f'{"Would update" if test_mode else "Updated"}: {updated_count}, Failed: {failed_count}')
        ) 