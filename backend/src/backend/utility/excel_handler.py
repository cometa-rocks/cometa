from itertools import islice
import pandas as pd
import json
import os
import tempfile
import subprocess
from typing import Optional, List, Dict, Any, Tuple
from backend.utility.functions import getLogger

logger = getLogger()


class ExcelGridHandler:
    """
    Agnostic Excel and grid data handler for processing CSV and Excel files.
    Can be used across different parts of the application for consistent file processing.
    """
    
    def __init__(self, file_path: str):
        """
        Initialize the handler with a file path.
        
        Args:
            file_path (str): Path to the Excel or CSV file
        """
        self.file_path = file_path
        self.sheet_names = []
        self.column_order = []
        self.selected_sheet = None
        
    def get_sheet_names(self) -> List[str]:
        """
        Get all sheet names from an Excel file.
        
        Returns:
            List[str]: List of sheet names, empty list for CSV files
        """
        if self.file_path.lower().endswith('.csv'):
            return []
            
        try:
            xls = pd.ExcelFile(self.file_path)
            self.sheet_names = xls.sheet_names
            return self.sheet_names
        except Exception as e:
            logger.error(f"Error getting sheet names from {self.file_path}: {e}")
            return []
    
    def read_file_data(self, sheet_name: Optional[str] = None) -> Tuple[pd.DataFrame, Dict[str, Any]]:
        """
        Read data from CSV or Excel file.
        
        Args:
            sheet_name (Optional[str]): Specific sheet name to read from Excel file
            
        Returns:
            Tuple[pd.DataFrame, Dict[str, Any]]: DataFrame with data and metadata dict
        """
        metadata = {
            'sheet_names': [],
            'selected_sheet': None,
            'column_order': [],
            'file_type': 'csv' if self.file_path.lower().endswith('.csv') else 'excel'
        }
        
        try:
            if self.file_path.lower().endswith('.csv'):
                df = pd.read_csv(self.file_path, header=0, skipinitialspace=True, skip_blank_lines=True)
                metadata['column_order'] = list(df.columns)
                self.column_order = metadata['column_order']
                
            else:
                # Handle Excel files
                try:
                    xls = pd.ExcelFile(self.file_path)
                    metadata['sheet_names'] = xls.sheet_names
                    self.sheet_names = metadata['sheet_names']
                    
                    # Determine which sheet to read
                    if sheet_name and sheet_name in metadata['sheet_names']:
                        logger.info(f"Reading Excel file with specified sheet: {sheet_name}")
                        df = pd.read_excel(xls, sheet_name=sheet_name, header=0)
                        metadata['selected_sheet'] = sheet_name
                        self.selected_sheet = sheet_name
                    else:
                        # Use first sheet if no sheet specified or specified sheet not found
                        selected_sheet = metadata['sheet_names'][0] if metadata['sheet_names'] else 'Sheet1'
                        logger.info(f"Reading Excel file with first sheet: {selected_sheet}")
                        df = pd.read_excel(xls, sheet_name=selected_sheet, header=0)
                        metadata['selected_sheet'] = selected_sheet
                        self.selected_sheet = selected_sheet
                    
                    metadata['column_order'] = list(df.columns)
                    self.column_order = metadata['column_order']
                    
                except Exception as e_excel:
                    logger.error(f"Error parsing Excel file: {e_excel}")
                    raise Exception(f"Unable to parse Excel file: {str(e_excel)}")
                    
        except ValueError as e_csv:
            logger.error(f"Error parsing file as CSV: {e_csv}")
            # Try again as Excel in case it was misidentified
            try:
                xls = pd.ExcelFile(self.file_path)
                metadata['sheet_names'] = xls.sheet_names
                self.sheet_names = metadata['sheet_names']
                
                # Use requested sheet if specified and available
                if sheet_name and sheet_name in metadata['sheet_names']:
                    df = pd.read_excel(xls, sheet_name=sheet_name, header=0)
                    metadata['selected_sheet'] = sheet_name
                    self.selected_sheet = sheet_name
                else:
                    selected_sheet = metadata['sheet_names'][0] if metadata['sheet_names'] else 'Sheet1'
                    df = pd.read_excel(xls, header=0)
                    metadata['selected_sheet'] = selected_sheet
                    self.selected_sheet = selected_sheet
                
                metadata['column_order'] = list(df.columns)
                self.column_order = metadata['column_order']
                
            except Exception as e_excel:
                logger.error(f"Error parsing file as Excel after CSV parsing failed: {e_excel}")
                raise Exception("Unable to parse excel or csv file.")
        
        return df, metadata
    
    def normalize_column_names(self, df: pd.DataFrame) -> pd.DataFrame:
        """
        Normalize column names by replacing spaces with underscores and converting to lowercase.
        
        Args:
            df (pd.DataFrame): DataFrame to normalize
            
        Returns:
            pd.DataFrame: DataFrame with normalized column names
        """
        if len(df.columns) > 0:
            df.columns = df.columns.str.replace(" ", "_").str.lower()
        return df
    
    def check_data_driven_ready(self, df: pd.DataFrame) -> Dict[str, Any]:
        """
        Check if the data is ready for data-driven testing.
        
        Args:
            df (pd.DataFrame): DataFrame to check
            
        Returns:
            Dict[str, Any]: Data-driven readiness status
        """
        ddr_ready = 'feature_id' in df.columns or 'feature_name' in df.columns
        
        if ddr_ready:
            return {
                'data-driven-ready': True
            }
        else:
            return {
                'data-driven-ready': False,
                'reason': 'Missing \'feature_id\' or \'feature_name\' columns. This file can be viewed but not used for data-driven testing.'
            }
    
    def dataframe_to_json_records(self, df: pd.DataFrame) -> List[str]:
        """
        Convert DataFrame to JSON records format.
        
        Args:
            df (pd.DataFrame): DataFrame to convert
            
        Returns:
            List[str]: List of JSON string records
        """
        return df.to_json(orient='records', lines=True).splitlines()
    
    def create_data_batches(self, json_data: List[str], batch_size: int = 100) -> List[Dict[str, Any]]:
        """
        Create batches of data for efficient processing.
        
        Args:
            json_data (List[str]): List of JSON string records
            batch_size (int): Size of each batch
            
        Returns:
            List[Dict[str, Any]]: List of parsed JSON objects
        """
        if len(json_data) == 0:
            return []
            
        rows = (json.loads(data) for data in json_data)
        
        all_data = []
        while True:
            batch = list(islice(rows, batch_size))
            if not batch:
                break
            all_data.extend(batch)
        
        return all_data
    
    def process_file(self, sheet_name: Optional[str] = None, 
                    normalize_columns: bool = True,
                    check_ddr: bool = True,
                    batch_size: int = 100) -> Dict[str, Any]:
        """
        Complete file processing pipeline.
        
        Args:
            sheet_name (Optional[str]): Specific sheet to process
            normalize_columns (bool): Whether to normalize column names
            check_ddr (bool): Whether to check data-driven readiness
            batch_size (int): Batch size for data processing
            
        Returns:
            Dict[str, Any]: Complete processing result with data and metadata
        """
        # Read the file
        df, metadata = self.read_file_data(sheet_name)
        
        # Normalize column names if requested
        if normalize_columns:
            df = self.normalize_column_names(df)
        
        # Check data-driven readiness if requested
        ddr_status = None
        if check_ddr:
            ddr_status = self.check_data_driven_ready(df)
        
        # Convert to JSON records
        json_data = self.dataframe_to_json_records(df)
        logger.info(f"DataFrame converted to {len(json_data)} JSON records")
        
        # Create data batches
        processed_data = self.create_data_batches(json_data, batch_size)
        logger.info(f"Created {len(processed_data)} data records from {len(json_data)} JSON records")
        
        result = {
            'data': processed_data,
            'metadata': metadata,
            'ddr_status': ddr_status,
            'row_count': len(processed_data),
            'dataframe': df
        }
        
        return result


def create_excel_handler(file_path: str) -> ExcelGridHandler:
    """
    Factory function to create an ExcelGridHandler instance.
    
    Args:
        file_path (str): Path to the file to process
        
    Returns:
        ExcelGridHandler: Configured handler instance
    """
    return ExcelGridHandler(file_path)


class DataValidationUtils:
    """
    Utility class for data validation operations, particularly for data-driven testing.
    """
    
    @staticmethod
    def validate_data_driven_requirements(file_data: List[Dict[str, Any]], feature_model) -> Dict[str, Any]:
        """
        Validate that file data meets requirements for data-driven testing.
        
        Args:
            file_data: List of row data dictionaries
            feature_model: Django model class for Feature lookups
            
        Returns:
            Dict containing validation results
        """
        missing_features = []
        
        for index, row_data in enumerate(file_data):
            feature_id = row_data.get('feature_id', None)
            feature_name = row_data.get('feature_name', None)

            if not feature_id and not feature_name:
                return {
                    'success': False,
                    'error': f'Row {index + 1}: Missing \'feature_id\' or \'feature_name\'.'
                }
            
            feature_exists = False
            try:
                if feature_id:
                    if feature_model.objects.filter(pk=feature_id).exists():
                        feature_exists = True
                if not feature_exists and feature_name:
                     if feature_model.objects.filter(feature_name=feature_name).exists():
                         feature_exists = True
            except Exception as e:
                logger.warning(f"Error looking up feature in row {index + 1}: {e}")
                feature_exists = False

            if not feature_exists:
                missing_identifier = feature_id if feature_id else feature_name
                missing_features.append(f"Row {index + 1} (Feature: '{missing_identifier}')")

        if missing_features:
            error_message = "File cannot be executed. The following referenced features do not exist: " + ", ".join(missing_features)
            return {
                'success': False,
                'error': error_message
            }
        
        return {'success': True}


class DataFrameUtils:
    """
    Utility class for DataFrame manipulation operations.
    """
    
    @staticmethod
    def clean_header_for_display(header: str) -> str:
        """
        Clean header for UI display while preserving readability.
        
        Args:
            header: Original header from file
            
        Returns:
            Cleaned header for UI display
        """
        if not header:
            return header
            
        # Remove leading/trailing slashes and underscores
        cleaned = header.strip('/_')
        
        # Replace underscores with spaces
        cleaned = cleaned.replace('_', ' ')
        
        # Replace multiple spaces with single space
        cleaned = ' '.join(cleaned.split())
        
        # Convert to title case for better readability
        cleaned = cleaned.title()
        
        # Handle common abbreviations that should remain uppercase
        cleaned = cleaned.replace(' Id', ' ID')
        cleaned = cleaned.replace(' Url', ' URL')
        cleaned = cleaned.replace(' Api', ' API')
        cleaned = cleaned.replace(' Html', ' HTML')
        cleaned = cleaned.replace(' Json', ' JSON')
        cleaned = cleaned.replace(' Xml', ' XML')
        
        return cleaned
    
    @staticmethod
    def detect_file_format(file_name: str) -> str:
        """
        Detect file format from filename.
        
        Args:
            file_name: Name of the file
            
        Returns:
            File extension (.csv, .xlsx, .xls)
        """
        file_name_lower = file_name.lower()
        if file_name_lower.endswith('.csv'):
            return '.csv'
        elif file_name_lower.endswith('.xlsx'):
            return '.xlsx'
        elif file_name_lower.endswith('.xls'):
            return '.xls'
        else:
            return '.csv'  # Default to CSV
    
    @staticmethod
    def is_excel_file(file_name: str) -> bool:
        """
        Check if file is an Excel file.
        
        Args:
            file_name: Name of the file
            
        Returns:
            True if Excel file, False otherwise
        """
        file_name_lower = file_name.lower()
        return file_name_lower.endswith('.xls') or file_name_lower.endswith('.xlsx')
    
    @staticmethod
    def clean_dataframe_types(df: pd.DataFrame) -> pd.DataFrame:
        """
        Clean DataFrame by converting problematic data types to strings.
        
        Args:
            df: DataFrame to clean
            
        Returns:
            Cleaned DataFrame
        """
        df_copy = df.copy()
        
        # Convert any problematic data types (like complex objects) to strings
        for col in df_copy.columns:
            if df_copy[col].apply(lambda x: isinstance(x, (dict, list))).any():
                logger.info(f"Converting column '{col}' from complex type to string")
                df_copy[col] = df_copy[col].apply(lambda x: str(x) if x is not None else '')
        
        # Ensure feature_id is numeric if present
        if 'feature_id' in df_copy.columns:
            logger.info("Ensuring feature_id is properly formatted")
            df_copy['feature_id'] = pd.to_numeric(df_copy['feature_id'], errors='coerce').fillna(0).astype(int)
        
        return df_copy
    
    @staticmethod
    def create_column_mapping(column_order: List[str]) -> Tuple[Dict[str, str], Dict[str, str]]:
        """
        Create bidirectional mapping between field names and display headers.
        
        Args:
            column_order: List of column headers in desired order
            
        Returns:
            Tuple of (field_to_header_map, header_to_field_map)
        """
        field_to_header_map = {}
        header_to_field_map = {}
        
        for header in column_order:
            field_name = header.lower().replace(' ', '_')
            field_to_header_map[field_name] = header
            header_to_field_map[header] = field_name
        
        return field_to_header_map, header_to_field_map
    
    @staticmethod
    def reorder_dataframe_columns(df: pd.DataFrame, column_order: List[str]) -> pd.DataFrame:
        """
        Reorder DataFrame columns based on specified order.
        
        Args:
            df: DataFrame to reorder
            column_order: Desired column order (display headers)
            
        Returns:
            DataFrame with reordered columns
        """
        df_copy = df.copy()
        field_to_header_map, _ = DataFrameUtils.create_column_mapping(column_order)
        
        ordered_columns = []
        df_columns = df_copy.columns.tolist()
        
        # First, add columns in the order specified by column_order
        for header in column_order:
            field_name = header.lower().replace(' ', '_')
            if field_name in df_columns:
                ordered_columns.append(field_name)
                df_columns.remove(field_name)
        
        # Then add any remaining columns that weren't in column_order
        ordered_columns.extend(df_columns)
        
        logger.info(f"Reordering DataFrame columns to: {ordered_columns}")
        return df_copy[ordered_columns]
    
    @staticmethod
    def rename_columns_for_output(df: pd.DataFrame, column_order: List[str]) -> pd.DataFrame:
        """
        Rename DataFrame columns from field names to display headers.
        
        Args:
            df: DataFrame to rename
            column_order: List of display headers
            
        Returns:
            DataFrame with renamed columns
        """
        df_copy = df.copy()
        field_to_header_map, _ = DataFrameUtils.create_column_mapping(column_order)
        
        rename_dict = {}
        for field_name in df_copy.columns:
            if field_name in field_to_header_map:
                rename_dict[field_name] = field_to_header_map[field_name]
        
        if rename_dict:
            logger.info(f"Renaming columns for file output: {rename_dict}")
            df_copy = df_copy.rename(columns=rename_dict)
        
        return df_copy
    
    @staticmethod
    def restore_original_column_names_from_mapping(df: pd.DataFrame, column_headers: Dict[str, str]) -> pd.DataFrame:
        """
        Restore original column names from a field -> header mapping.
        This preserves the original names for file downloads.
        
        Args:
            df: DataFrame with field names as columns
            column_headers: Mapping of original_field_name -> display_header
            
        Returns:
            DataFrame with original column names restored
        """
        df_copy = df.copy()
        
        # The column_headers dict maps original_field -> display_header
        # We want to keep the original field names as they are (no renaming needed)
        # This function ensures we maintain the original field names in the DataFrame
        
        # Validate that all DataFrame columns exist in the mapping
        missing_columns = set(df_copy.columns) - set(column_headers.keys())
        if missing_columns:
            logger.warning(f"Some columns not found in headers mapping: {missing_columns}")
        
        # No renaming needed - we want to keep original field names for downloads
        logger.info(f"Preserving original column names for file output: {list(df_copy.columns)}")
        return df_copy
    
    @staticmethod
    def restore_original_column_names(df: pd.DataFrame, original_columns: List[str]) -> pd.DataFrame:
        """
        Restore original column names from normalized field names.
        
        Args:
            df: DataFrame with normalized column names
            original_columns: List of original column names
            
        Returns:
            DataFrame with restored column names
        """
        if not original_columns:
            return df
        
        df_copy = df.copy()
        column_mapping = {col.lower().replace(' ', '_'): col for col in original_columns}
        
        rename_dict = {}
        for col in df_copy.columns:
            if col in column_mapping:
                rename_dict[col] = column_mapping[col]
        
        if rename_dict:
            df_copy = df_copy.rename(columns=rename_dict)
        
        return df_copy


class ExcelSheetManager:
    """
    Utility class for managing Excel sheets and multi-sheet operations.
    """
    
    @staticmethod
    def save_dataframe_to_file(df: pd.DataFrame, file_path: str, file_extension: str, 
                              sheet_name: Optional[str] = None, 
                              original_file_path: Optional[str] = None,
                              preserve_other_sheets: bool = True) -> None:
        """
        Save DataFrame to file with proper format handling.
        
        Args:
            df: DataFrame to save
            file_path: Path to save the file
            file_extension: File extension (.csv, .xlsx, .xls)
            sheet_name: Sheet name for Excel files
            original_file_path: Path to original file for sheet preservation
            preserve_other_sheets: Whether to preserve other sheets in Excel files
        """
        if file_extension == '.csv':
            logger.info(f"Saving updated file to CSV format: {file_path}")
            df.to_csv(file_path, index=False)
        else:
            try:
                import openpyxl
                logger.info(f"Attempting to save as Excel format: {file_path}")
                
                if preserve_other_sheets and original_file_path and sheet_name:
                    ExcelSheetManager._save_excel_with_sheet_preservation(
                        df, file_path, sheet_name, original_file_path
                    )
                else:
                    df.to_excel(file_path, index=False, engine='openpyxl')
                    
            except ImportError:
                logger.warning("openpyxl not available. Falling back to CSV format.")
                csv_path = file_path.replace(file_extension, '.csv')
                df.to_csv(csv_path, index=False)
            except Exception as excel_err:
                logger.error(f"Error saving Excel file: {str(excel_err)}")
                logger.warning("Falling back to CSV format due to Excel error.")
                csv_path = file_path.replace(file_extension, '.csv')
                df.to_csv(csv_path, index=False)
    
    @staticmethod
    def _save_excel_with_sheet_preservation(df: pd.DataFrame, output_path: str, 
                                          target_sheet: str, original_file_path: str) -> None:
        """
        Save Excel file while preserving other sheets.
        
        Args:
            df: DataFrame to save in target sheet
            output_path: Path to save the file
            target_sheet: Name of sheet to update
            original_file_path: Path to original file
        """
        try:
            # Read all sheets from the original file
            with pd.ExcelFile(original_file_path) as xls:
                sheet_names = xls.sheet_names
                logger.info(f"Original file has sheets: {sheet_names}")
                
                # Create a new Excel writer
                with pd.ExcelWriter(output_path, engine='openpyxl') as writer:
                    # Copy all sheets from the original file
                    for original_sheet in sheet_names:
                        if original_sheet == target_sheet:
                            # For the sheet being updated, write new data
                            logger.info(f"Writing updated data to sheet: {target_sheet}")
                            df.to_excel(writer, sheet_name=target_sheet, index=False)
                        else:
                            # For other sheets, copy original data
                            logger.info(f"Copying original data from sheet: {original_sheet}")
                            sheet_df = pd.read_excel(xls, sheet_name=original_sheet)
                            sheet_df.to_excel(writer, sheet_name=original_sheet, index=False)
        finally:
            # Clean up the original file if it exists
            if os.path.exists(original_file_path):
                try:
                    os.remove(original_file_path)
                except Exception as cleanup_err:
                    logger.warning(f"Failed to remove temporary original file: {cleanup_err}")
    
    @staticmethod
    def encrypt_file(source_path: str, target_path: str, passphrase: str) -> None:
        """
        Encrypt a file using GPG.
        
        Args:
            source_path: Path to source file
            target_path: Path to encrypted output file
            passphrase: Encryption passphrase
            
        Raises:
            Exception: If encryption fails
        """
        if not passphrase:
            raise Exception("Encryption passphrase is not configured")
        
        if not os.path.exists(source_path):
            raise Exception(f"Source file {source_path} not found")
        
        # Check if the target directory exists
        target_dir = os.path.dirname(target_path)
        if not os.path.exists(target_dir):
            logger.info(f"Creating target directory: {target_dir}")
            os.makedirs(target_dir, exist_ok=True)
            
        encryption_cmd = f"gpg --output {target_path} --batch --yes --passphrase {passphrase} --symmetric --cipher-algo AES256 {source_path}"
        logger.info(f"Running encryption command (sensitive data redacted)")
        
        try:
            result = subprocess.run(
                ["bash", "-c", encryption_cmd], 
                stdout=subprocess.PIPE, 
                stderr=subprocess.PIPE, 
                check=True
            )
        except subprocess.CalledProcessError as e:
            stderr_output = e.stderr.decode('utf-8') if e.stderr else "No error output"
            logger.error(f"GPG encryption command failed with code {e.returncode}")
            logger.error(f"Error output: {stderr_output}")
            raise Exception(f"Failed to encrypt file: {stderr_output}")


class FileUpdateManager:
    """
    High-level utility for managing file updates with DataFrame operations.
    """
    
    @staticmethod
    def update_file_with_dataframe(file_data_rows: List[Dict[str, Any]], 
                                 file_path: str, 
                                 file_name: str,
                                 encryption_passphrase: str,
                                 column_order: Optional[List[str]] = None,
                                 sheet_name: Optional[str] = None,
                                 original_columns: Optional[List[str]] = None,
                                 decrypt_function: Optional[callable] = None) -> Dict[str, Any]:
        """
        Complete file update pipeline with DataFrame operations.
        
        Args:
            file_data_rows: List of row data dictionaries
            file_path: Path to the file to update
            file_name: Name of the file
            encryption_passphrase: Passphrase for encryption
            column_order: Desired column order
            sheet_name: Sheet name for Excel files
            original_columns: Original column names
            decrypt_function: Function to decrypt original file
            
        Returns:
            Dict with success status and metadata
        """
        try:
            # Create DataFrame from updated data
            df = pd.DataFrame(file_data_rows)
            logger.info(f"DataFrame columns: {df.columns.tolist()}")
            logger.info(f"DataFrame shape: {df.shape}")
            
            # Clean data types
            df = DataFrameUtils.clean_dataframe_types(df)
            
            # Handle column ordering
            if column_order:
                logger.info(f"Processing column order: {column_order}")
                df = DataFrameUtils.reorder_dataframe_columns(df, column_order)
                df = DataFrameUtils.rename_columns_for_output(df, column_order)
            elif original_columns:
                df = DataFrameUtils.restore_original_column_names(df, original_columns)
            
            # Determine file format
            file_extension = DataFrameUtils.detect_file_format(file_name)
            is_excel = DataFrameUtils.is_excel_file(file_name)
            
            # Create temporary file
            with tempfile.NamedTemporaryFile(suffix=file_extension, delete=False) as temp_file:
                temp_path = temp_file.name
            
            # Ensure correct extension
            if not temp_path.endswith(file_extension):
                os.rename(temp_path, temp_path + file_extension)
                temp_path = temp_path + file_extension
            
            try:
                # Get original file for sheet preservation if needed
                original_file_path = None
                if is_excel and sheet_name and decrypt_function:
                    original_file_path = decrypt_function(file_path)
                
                # Save DataFrame to temporary file
                ExcelSheetManager.save_dataframe_to_file(
                    df, temp_path, file_extension, sheet_name, 
                    original_file_path, preserve_other_sheets=True
                )
                
                # Encrypt the updated file
                ExcelSheetManager.encrypt_file(temp_path, file_path, encryption_passphrase)
                
                return {
                    'success': True,
                    'rows_updated': len(file_data_rows),
                    'file_extension': file_extension
                }
                
            finally:
                # Clean up temporary file
                if os.path.exists(temp_path):
                    try:
                        os.remove(temp_path)
                        logger.info(f"Removed temporary file: {temp_path}")
                    except Exception as cleanup_err:
                        logger.warning(f"Failed to remove temporary file: {cleanup_err}")
                        
        except Exception as e:
            logger.error(f"Error in file update pipeline: {str(e)}")
            return {
                'success': False,
                'error': str(e)
            }