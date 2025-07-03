# ###
# Sponsored by Mercedes-Benz AG, Stuttgart
# ###

from backend.models import (
    File,
    Feature,
    Feature_result,
    FileData,
    Feature_Task
)
from backend.serializers import (
    FeatureResultSerializer,
    FileSerializer,
    FileDataSerializer
)
from backend.views import (
    GetUserDepartments,
    runFeature,
    logger
)
from concurrent.futures import (
    ThreadPoolExecutor,
    as_completed,
    TimeoutError,
    ThreadPoolExecutor
)
from backend.utility.decorators import (
    require_permissions,
    require_subscription
)
from django.views.decorators.csrf import csrf_exempt
from threading import Thread
from rest_framework import viewsets
from rest_framework.renderers import JSONRenderer
from django.http import JsonResponse
from backend.utility.uploadFile import getFileContent
from .models import DataDriven_Runs
from .serializers import DataDrivenRunsSerializer
import time, json
from django.views.decorators.http import require_http_methods
import requests, traceback
from backend.utility.config_handler import *
from rest_framework.response import Response
import tempfile
import os
import subprocess
from django.db import transaction
from backend.utility.file_lock_manager import file_lock_manager, FileLockAcquisitionError


def process_queued_ddt_runs(file_id):
    """
    Process the next queued DDT run for a specific file.
    This function is called when a DDT run completes to start the next queued run.
    """
    try:
        # Find the oldest queued DDT run for this file
        queued_run = DataDriven_Runs.objects.filter(
            file_id=file_id,
            status="Queued",
            running=False
        ).order_by('date_time').first()
        
        if not queued_run:
            logger.debug(f"[QUEUE PROCESSOR] No queued DDT runs found for file {file_id}")
            return
        
        logger.info(f"[QUEUE PROCESSOR] Starting queued DDT run {queued_run.run_id} for file {file_id}")
        
        # Try to acquire the lock for the queued run
        lock_identifier = file_lock_manager.acquire_file_lock(file_id)
        if not lock_identifier:
            logger.warning(f"[QUEUE PROCESSOR] Could not acquire lock for file {file_id}, run {queued_run.run_id} remains queued")
            return
        
        # Update the queued run to running status
        queued_run.status = "Running"
        queued_run.running = True
        queued_run.lock_identifier = lock_identifier
        queued_run.save()
        
        logger.info(f"[QUEUE PROCESSOR] Successfully started queued DDT run {queued_run.run_id} with lock {lock_identifier}")
        
        # Send WebSocket message that the queued run is now starting
        socket_payload = {
            "running": True,
            "status": "Running",
            "run_id": queued_run.run_id,
            "file_id": file_id,
            "message": f"Queued data-driven test is now starting...",
            "origin": "QUEUE_PROCESSOR"
        }
        
        try:
            response = requests.post(f'{get_cometa_socket_url()}/dataDrivenStatus/{queued_run.run_id}', socket_payload)
            if response.status_code == 200:
                logger.debug(f"[QUEUE PROCESSOR] Sent running WebSocket message for run {queued_run.run_id}")
            else:
                logger.warning(f"[QUEUE PROCESSOR] Failed to send running WebSocket message: {response.status_code} - {response.text}")
        except Exception as ws_error:
            logger.warning(f"[QUEUE PROCESSOR] Failed to send running WebSocket message: {ws_error}")
        
        # Start the DDT execution in a separate thread
        def execute_queued_ddt():
            try:
                # Get file data for the queued run
                file_data = queued_run.file.file.all()
                if len(file_data) == 0:
                    logger.error(f"[QUEUE PROCESSOR] No file data found for run {queued_run.run_id}")
                    return
                
                # Create a mock request object for the execution with proper user session structure
                # Get the file's department to properly set up the mock user permissions
                file_department_id = queued_run.file.department_id
                
                class MockRequest:
                    def __init__(self, original_user_id, department_id):
                        # Use the original user who initiated the DDT run
                        if original_user_id:
                            try:
                                from backend.models import OIDCAccount
                                from backend.serializers import OIDCAccountLoginSerializer
                                
                                # Get the original user from the database
                                original_user = OIDCAccount.objects.get(user_id=original_user_id)
                                user_data = OIDCAccountLoginSerializer(original_user, many=False).data
                                
                                # Override name to indicate this is a queued execution
                                user_data['name'] = f"Queue Processor ({original_user.email})"
                                
                            except Exception as e:
                                logger.warning(f"[QUEUE PROCESSOR] Could not load original user {original_user_id}: {e}")
                                # Fallback to system user
                                user_data = {
                                    'name': 'Queue Processor (System)',
                                    'user_id': 'system',
                                    'departments': [{'department_id': department_id}],
                                    'subscriptions': [{'cloud': 'local', 'active': True, 'plan': 'system'}],
                                    'user_permissions': {'permission_name': 'ADMIN', 'show_all_departments': False, 'show_department_users': False}
                                }
                        else:
                            # Fallback if no user was stored
                            user_data = {
                                'name': 'Queue Processor (No User)',
                                'user_id': 'system',
                                'departments': [{'department_id': department_id}],
                                'subscriptions': [{'cloud': 'local', 'active': True, 'plan': 'system'}],
                                'user_permissions': {'permission_name': 'ADMIN', 'show_all_departments': False, 'show_department_users': False}
                            }
                        
                        self.session = {'user': user_data}
                        self.META = {
                            'HTTP_COMETA_ORIGIN': 'QUEUE_PROCESSOR',
                            'HTTP_COMETA_USER': str(original_user_id) if original_user_id else 'system'
                        }
                
                # Use the stored user who initiated the queued run
                original_user_id = queued_run.initiated_by_id
                mock_request = MockRequest(original_user_id, file_department_id)
                
                # Execute the DDT run using the same logic as the main function
                startDataDrivenRun(mock_request, file_data, queued_run, lock_identifier)
                
            except Exception as e:
                logger.error(f"[QUEUE PROCESSOR] Error executing queued DDT run {queued_run.run_id}: {e}")
                # Clean up on error
                try:
                    file_lock_manager.release_file_lock(file_id, lock_identifier)
                    queued_run.status = "Failed"
                    queued_run.running = False
                    queued_run.save()
                except Exception as cleanup_error:
                    logger.error(f"[QUEUE PROCESSOR] Error during cleanup: {cleanup_error}")
        
        # Start execution in background thread
        Thread(target=execute_queued_ddt, daemon=True).start()
        
    except Exception as e:
        logger.error(f"[QUEUE PROCESSOR] Error processing queued DDT runs for file {file_id}: {e}")


class DataDrivenResultsViewset(viewsets.ModelViewSet):
    queryset = DataDriven_Runs.objects.none()
    serializer_class = FeatureResultSerializer
    renderer_classes = (JSONRenderer, )

    def list(self, request, *args, **kwargs):
        run_id = kwargs.get('run_id', None)
        user_departments = GetUserDepartments(request)

        if not run_id:
            return JsonResponse({
                'success': False,
                'error': 'No \'run_id\' provided.'
            }, status=200)
        try:
            ddr = DataDriven_Runs.objects.prefetch_related('feature_results').get(pk=run_id, file__department_id__in=user_departments)
        except DataDriven_Runs.DoesNotExist:
            return JsonResponse({
                'success': False,
                'error': 'Data Driven Run not found.'
            }, status=200)

        page = self.paginate_queryset(ddr.feature_results.all())
        # serialize the data
        serialized_data = self.serializer_class(page, many=True).data
        # return the data with count, next and previous pages.
        return self.get_paginated_response(serialized_data)

class DataDrivenViewset(viewsets.ModelViewSet):
    queryset = DataDriven_Runs.objects.none()
    serializer_class = DataDrivenRunsSerializer
    renderer_classes = (JSONRenderer, )

    def list(self, request, *args, **kwargs):
        run_id = kwargs.get('run_id', None)
        user_departments = GetUserDepartments(request)

        if run_id:
            try:
                ddr = DataDriven_Runs.objects.get(pk=run_id, file__department_id__in=user_departments)
            except DataDriven_Runs.DoesNotExist:
                return JsonResponse({
                    'success': False,
                    'error': 'Data Driven Run not found.'
                }, status=200)
            # get the data related to the run
            return JsonResponse({
                'success': True,
                'result': DataDrivenRunsSerializer(ddr, many=False).data
            })

        # This part handles requests for the list of runs
        ddrs = DataDriven_Runs.objects.filter(file__department_id__in=user_departments)

        # Get department_id from query parameters
        department_id = request.GET.get('department_id', None)
        if department_id:
            try:
                # Attempt to convert to integer and filter
                department_id_int = int(department_id)
                ddrs = ddrs.filter(file__department_id=department_id_int)
            except (ValueError, TypeError):
                return JsonResponse({'success': False, 'error': 'Invalid department_id parameter.'}, status=200)

        # Get file_id from query parameters
        file_id = request.GET.get('file_id', None)
        if file_id:
            try:
                # Attempt to convert to integer and filter
                file_id_int = int(file_id)
                ddrs = ddrs.filter(file_id=file_id_int)
            except (ValueError, TypeError):
                return JsonResponse({'success': False, 'error': 'Invalid file_id parameter.'}, status=200)
        
        # Filter by active files only if requested
        active_files_only = request.GET.get('active_files_only', None)
        if active_files_only == 'true':
            ddrs = ddrs.filter(file__is_removed=False)

        # Apply ordering after filtering
        ddrs = ddrs.order_by('-date_time', '-run_id')

        # get the amount of data per page using the queryset
        page = self.paginate_queryset(DataDrivenRunsSerializer.setup_eager_loading(ddrs))
        # serialize the data
        serialized_data = DataDrivenRunsSerializer(page, many=True).data
        # return the data with count, next and previous pages.
        return self.get_paginated_response(serialized_data)
    
    def delete(self, request, *args, **kwargs):
        run_id = kwargs.get('run_id', None)

        if not run_id:
            return JsonResponse({
                'success': False,
                'error': 'Missing \'run_id\' parameter.'
            }, status=200)

        try:
            ddr = DataDriven_Runs.objects.get(pk=run_id, file__department__in=GetUserDepartments(request))
        except DataDriven_Runs.DoesNotExist:
            return JsonResponse({
                'success': False,
                'error': 'Run not found.'
            }, status=200)
        
        ddr.delete()

        return JsonResponse({
            'success': True
        })

class DataDrivenFileViewset(viewsets.ModelViewSet):
    queryset = File.objects.none()
    serializer_class = FileSerializer
    renderer_classes = (JSONRenderer, )

    def list(self, request, *args, **kwargs):
        file_id = kwargs.get('file_id', None)
        reparse = request.GET.get('reparse', None)

        try:
            file = File.objects.prefetch_related('file').get(pk=file_id)
        except File.DoesNotExist:
            return JsonResponse({
                "success": False,
                "error": "File not found."
            }, status=200)
        
        # get user departments
        user_departments = GetUserDepartments(request)
        if file.department.department_id not in user_departments:
            return JsonResponse({
                "success": False,
                "error": "You do not have access to this object."
            }, status=200)
        
        # Check if a specific sheet was requested for Excel files
        sheet_name = request.GET.get('sheet', None)
        
        # Determine if it's an Excel file by extension
        file_name = file.name.lower()
        is_excel = file_name.endswith('.xls') or file_name.endswith('.xlsx')
        
        # file.all() comes from the reverse relation between FileData and File model.
        file_data = file.file.all()

        if reparse or not file_data:
            # delete any old data only works incase of reparse
            file_data.delete()
            try:
                # parse file data
                file_data = getFileContent(file, sheet_name=sheet_name if is_excel else None)
                file.save()
            except Exception as err:
                traceback.print_exc()
                return JsonResponse({
                    "success": False,
                    "error": str(err) 
                }, status=200)
        elif is_excel and sheet_name:
            # For Excel files with a specified sheet, filter existing data by sheet
            logger.info(f"Filtering existing data for sheet '{sheet_name}' in Excel file {file_id}")
            
            # First, try to get existing data for the specified sheet
            sheet_data = file_data.filter(sheet=sheet_name)
            
            if sheet_data.exists():
                # Use existing data for the sheet
                file_data = sheet_data
                logger.info(f"Found {sheet_data.count()} existing records for sheet '{sheet_name}'")
            else:
                # If no data exists for this sheet, check if there's data with sheet=NULL 
                # (which might be the same data but without sheet info)
                null_sheet_data = file_data.filter(sheet__isnull=True)
                
                if null_sheet_data.exists() and sheet_name in (file.sheet_names or []):
                    # This might be legacy data before sheet support was added
                    logger.info(f"Found {null_sheet_data.count()} records with NULL sheet, which might be '{sheet_name}' data")
                    file_data = null_sheet_data
                else:
                    # If no data exists for this sheet, try to parse it
                    logger.info(f"No existing data for sheet '{sheet_name}', attempting to parse")
                    try:
                        # Parse data for the specific sheet and save it
                        temp_data = getFileContent(file, sheet_name=sheet_name)
                        file_data = temp_data
                        logger.info(f"Successfully parsed {len(temp_data)} rows for sheet '{sheet_name}'")
                    except Exception as err:
                        return JsonResponse({
                            "success": False,
                            "error": f"Error parsing sheet '{sheet_name}': {str(err)}" 
                        }, status=200)
        
        # paginate the queryset
        page = self.paginate_queryset(file_data)
        # serialize the paginated data
        serialized_data = FileDataSerializer(page, many=True).data
        # Get the paginated response
        paginated_response = self.get_paginated_response(serialized_data)
        # Add the columns_ordered field to the response data
        response_data = paginated_response.data
        # Include the column_order field from the file model if available
        if hasattr(file, 'column_order') and file.column_order:
            response_data['columns_ordered'] = [h.lower().replace(' ', '_') for h in file.column_order]
            # Also include a mapping from field names to original headers
            response_data['column_headers'] = {h.lower().replace(' ', '_'): h for h in file.column_order}
        else:
            # Fallback: If no column_order is available, extract column names from the first data row
            # and create a mapping where processed names map to themselves (for consistency)
            if serialized_data and len(serialized_data) > 0:
                first_data = serialized_data[0].get('data', {})
                if isinstance(first_data, dict) and first_data:
                    columns_from_data = list(first_data.keys())
                    response_data['columns_ordered'] = columns_from_data
                    # For consistency, map field names to themselves (no original names available)
                    response_data['column_headers'] = {col: col for col in columns_from_data}
                    logger.info(f"Using fallback column extraction for file {file.id}: {columns_from_data}")
        
        if hasattr(file, 'sheet_names') and file.sheet_names:
            response_data['sheet_names'] = file.sheet_names
        # Return the modified response
        return Response(response_data)
        
    @csrf_exempt
    @require_subscription()
    @require_permissions("run_feature")
    def put(self, request, *args, **kwargs):
        file_id = kwargs.get('file_id', None)
        
        # Get the sheet parameter if provided (for Excel files)
        sheet_name = request.GET.get('sheet', None)
        logger.info(f"PUT request for file {file_id}, sheet parameter: {sheet_name}")
        
        # Verify body can be parsed as JSON
        try:
            request_data = json.loads(request.body)
        except json.JSONDecodeError:
            return JsonResponse({ 'success': False, 'error': 'Unable to parse request body.' }, status=200)
            
        # Get the data array from the request
        file_data_rows = request_data.get('data', None)
        if not file_data_rows:
            return JsonResponse({ 'success': False, 'error': 'Missing data in request.' }, status=200)
        
        # Get the column order from the request if provided
        column_order = request_data.get('column_order', None)
        if column_order:
            logger.info(f"Received column order for file {file_id}: {column_order}")
        
        try:
            # Get the file and check permissions
            user_departments = GetUserDepartments(request)
            file = File.objects.get(pk=file_id, department_id__in=user_departments)
        except File.DoesNotExist:
            return JsonResponse({
                "success": False,
                "error": "File not found or you don't have access to it."
            }, status=200)
        
        try:
            import pandas as pd
            import os
            import tempfile
            import subprocess
            from backend.utility.config_handler import get_cometa_socket_url
            from backend.utility.configurations import ConfigurationManager
            
            # Check if it's an Excel file
            file_name = file.name.lower()
            is_excel = file_name.endswith('.xls') or file_name.endswith('.xlsx')
            
            # Make everything atomic - both file and database update must succeed together
            with transaction.atomic():
                # Create a pandas DataFrame from the updated data
                df = pd.DataFrame(file_data_rows)
                
                # Log DataFrame info for debugging
                logger.info(f"DataFrame columns: {df.columns.tolist()}")
                logger.info(f"DataFrame shape: {df.shape}")
                
                # Convert any problematic data types (like complex objects) to strings
                for col in df.columns:
                    # Check for nested objects or lists that might cause issues
                    if df[col].apply(lambda x: isinstance(x, (dict, list))).any():
                        logger.info(f"Converting column '{col}' from complex type to string")
                        df[col] = df[col].apply(lambda x: str(x) if x is not None else '')
                
                # Ensure feature_id is numeric if present (avoid type issues)
                if 'feature_id' in df.columns:
                    logger.info("Ensuring feature_id is properly formatted")
                    df['feature_id'] = pd.to_numeric(df['feature_id'], errors='coerce').fillna(0).astype(int)
                
                # Handle column ordering and renaming
                if column_order:
                    logger.info(f"Processing column order: {column_order}")
                    
                    # Create mapping from field names (lowercase with underscores) to display headers
                    field_to_header_map = {}
                    header_to_field_map = {}
                    
                    for header in column_order:
                        field_name = header.lower().replace(' ', '_')
                        field_to_header_map[field_name] = header
                        header_to_field_map[header] = field_name
                    
                    logger.info(f"Field to header mapping: {field_to_header_map}")
                    
                    # Reorder DataFrame columns to match the desired order
                    ordered_columns = []
                    df_columns = df.columns.tolist()
                    
                    # First, add columns in the order specified by column_order
                    for header in column_order:
                        field_name = header.lower().replace(' ', '_')
                        if field_name in df_columns:
                            ordered_columns.append(field_name)
                            df_columns.remove(field_name)
                    
                    # Then add any remaining columns that weren't in column_order
                    ordered_columns.extend(df_columns)
                    
                    logger.info(f"Reordering DataFrame columns to: {ordered_columns}")
                    df = df[ordered_columns]
                    
                    # Rename columns for file output using the display headers
                    rename_dict = {}
                    for field_name in df.columns:
                        if field_name in field_to_header_map:
                            rename_dict[field_name] = field_to_header_map[field_name]
                    
                    if rename_dict:
                        logger.info(f"Renaming columns for file output: {rename_dict}")
                        df = df.rename(columns=rename_dict)
                else:
                    # Fallback to original logic if no column_order provided
                    original_columns = file.column_order
                    
                    # If there are original columns, reorder to match them
                    if original_columns:
                        # Create a dict to map lowercase_no_spaces to original
                        column_mapping = {col.lower().replace(' ', '_'): col for col in original_columns}
                        
                        # Rename columns back to their original format for the file output
                        df_columns = df.columns
                        rename_dict = {}
                        for col in df_columns:
                            if col in column_mapping:
                                rename_dict[col] = column_mapping[col]
                        
                        if rename_dict:
                            df = df.rename(columns=rename_dict)
                
                # Create a temporary file with the correct extension
                # Determine original file extension to save in same format
                original_name = file.name.lower()
                if original_name.endswith('.csv'):
                    file_extension = '.csv'
                elif original_name.endswith('.xlsx'):
                    file_extension = '.xlsx'
                elif original_name.endswith('.xls'):
                    file_extension = '.xls'
                else:
                    # Default to CSV if unknown format
                    file_extension = '.csv'
                
                # Create a temporary file with the correct extension
                with tempfile.NamedTemporaryFile(suffix=file_extension, delete=False) as temp_file:
                    temp_path = temp_file.name
                
                # Log the temporary file path for debugging
                logger.info(f"Created temporary file: {temp_path}")
                
                # Double-check that the file has the correct extension
                if not temp_path.endswith(file_extension):
                    logger.warning(f"Temporary file doesn't have proper extension. Adding {file_extension}")
                    # If tempfile didn't add the extension correctly, add it manually
                    os.rename(temp_path, temp_path + file_extension)
                    temp_path = temp_path + file_extension
                
                # Save in the correct format based on extension
                if file_extension == '.csv':
                    logger.info(f"Saving updated file to CSV format: {temp_path}")
                    df.to_csv(temp_path, index=False)
                else:
                    # For Excel files, we need to handle sheet updates differently
                    try:
                        logger.info(f"Attempting to save as Excel format: {temp_path}")
                        import openpyxl
                        
                        # If this is an update to a specific sheet in an Excel file
                        if is_excel and sheet_name:
                            logger.info(f"Updating specific sheet '{sheet_name}' in Excel file")
                            
                            # First, we need to decrypt the original file to read all sheets
                            from backend.utility.uploadFile import decryptFile
                            original_file_path = decryptFile(file.path)
                            
                            try:
                                # Read all sheets from the original Excel file
                                with pd.ExcelFile(original_file_path) as xls:
                                    sheet_names = xls.sheet_names
                                    logger.info(f"Original file has sheets: {sheet_names}")
                                    
                                    # Create a new Excel writer
                                    with pd.ExcelWriter(temp_path, engine='openpyxl') as writer:
                                        # Copy all sheets from the original file
                                        for original_sheet in sheet_names:
                                            if original_sheet == sheet_name:
                                                # For the sheet being updated, write new data
                                                logger.info(f"Writing updated data to sheet: {sheet_name}")
                                                df.to_excel(writer, sheet_name=sheet_name, index=False)
                                            else:
                                                # For other sheets, copy original data
                                                logger.info(f"Copying original data from sheet: {original_sheet}")
                                                sheet_df = pd.read_excel(xls, sheet_name=original_sheet)
                                                sheet_df.to_excel(writer, sheet_name=original_sheet, index=False)
                            finally:
                                # Clean up the decrypted original file
                                if os.path.exists(original_file_path):
                                    try:
                                        os.remove(original_file_path)
                                    except Exception as cleanup_err:
                                        logger.warning(f"Failed to remove temporary original file: {cleanup_err}")
                        else:
                            # If no specific sheet is specified but it's an Excel file,
                            # we should still try to preserve all sheets
                            if is_excel and hasattr(file, 'sheet_names') and len(file.sheet_names) > 0:
                                # Similar approach as above, but if no sheet_name specified, use first sheet as default
                                logger.info(f"No specific sheet specified, but preserving all sheets in Excel file")
                                default_sheet = file.sheet_names[0] if file.sheet_names else 'Sheet1'
                                
                                # Decrypt the original file
                                from backend.utility.uploadFile import decryptFile
                                original_file_path = decryptFile(file.path)
                                
                                try:
                                    # Read all sheets from the original file
                                    with pd.ExcelFile(original_file_path) as xls:
                                        sheet_names = xls.sheet_names
                                        logger.info(f"Original file has sheets: {sheet_names}")
                                        
                                        # Create a new Excel writer
                                        with pd.ExcelWriter(temp_path, engine='openpyxl') as writer:
                                            # Copy all sheets from the original file
                                            for original_sheet in sheet_names:
                                                if original_sheet == default_sheet:
                                                    # For the default sheet, write new data
                                                    logger.info(f"Writing updated data to default sheet: {default_sheet}")
                                                    df.to_excel(writer, sheet_name=default_sheet, index=False)
                                                else:
                                                    # For other sheets, copy original data
                                                    logger.info(f"Copying original data from sheet: {original_sheet}")
                                                    sheet_df = pd.read_excel(xls, sheet_name=original_sheet)
                                                    sheet_df.to_excel(writer, sheet_name=original_sheet, index=False)
                                finally:
                                    # Clean up
                                    if os.path.exists(original_file_path):
                                        try:
                                            os.remove(original_file_path)
                                        except Exception as cleanup_err:
                                            logger.warning(f"Failed to remove temporary original file: {cleanup_err}")
                            else:
                                # If not a multi-sheet Excel file or no sheet_names attribute, just save directly
                                df.to_excel(temp_path, index=False, engine='openpyxl')
                            
                        logger.info("Successfully saved Excel file with openpyxl engine")
                    except ImportError as ie:
                        # Fall back to CSV if openpyxl not available
                        logger.warning(f"Excel dependency missing: {str(ie)}")
                        logger.warning("openpyxl not available. Falling back to CSV format.")
                        temp_path = temp_path.replace(file_extension, '.csv')
                        df.to_csv(temp_path, index=False)
                    except Exception as excel_err:
                        # If any other error occurs during Excel export, fall back to CSV
                        logger.error(f"Error saving Excel file: {str(excel_err)}")
                        logger.exception(excel_err)
                        logger.warning("Falling back to CSV format due to Excel error.")
                        temp_path = temp_path.replace(file_extension, '.csv')
                        df.to_csv(temp_path, index=False)
                
                # Get encryption passphrase
                COMETA_UPLOAD_ENCRYPTION_PASSPHRASE = ConfigurationManager.get_configuration('COMETA_UPLOAD_ENCRYPTION_PASSPHRASE','')
                
                # Encrypt the updated file - THIS MUST SUCCEED OR THE TRANSACTION WILL ROLLBACK
                try:
                    # Check if the encryption passphrase is set
                    if not COMETA_UPLOAD_ENCRYPTION_PASSPHRASE:
                        raise Exception("Encryption passphrase is not configured")
                    
                    # Check if the temp file exists
                    if not os.path.exists(temp_path):
                        raise Exception(f"Temporary file {temp_path} not found")
                    
                    # Check if the target directory exists
                    target_dir = os.path.dirname(file.path)
                    if not os.path.exists(target_dir):
                        logger.info(f"Creating target directory: {target_dir}")
                        os.makedirs(target_dir, exist_ok=True)
                        
                    # Use the same encryption method as in UploadFile.encrypt
                    encryption_cmd = f"gpg --output {file.path} --batch --yes --passphrase {COMETA_UPLOAD_ENCRYPTION_PASSPHRASE} --symmetric --cipher-algo AES256 {temp_path}"
                    logger.info(f"Running encryption command (sensitive data redacted)")
                    
                    result = subprocess.run(["bash", "-c", encryption_cmd], stdout=subprocess.PIPE, stderr=subprocess.PIPE, check=True)
                    
                    # If we get here, encryption succeeded, now update the database
                    if is_excel and sheet_name:
                        # For Excel sheet updates, only update the relevant data
                        # First, delete existing file data for this sheet if it exists
                        if 'sheet' in request_data and request_data['sheet'] == sheet_name:
                            # If we're updating a specific sheet, only delete that sheet's data
                            logger.info(f"Deleting data for sheet '{sheet_name}' in Excel file {file_id}")
                            sheet_data_count = FileData.objects.filter(file=file, sheet=sheet_name).count()
                            logger.info(f"Found {sheet_data_count} rows to delete in sheet '{sheet_name}'")
                            FileData.objects.filter(file=file, sheet=sheet_name).delete()
                        else:
                            logger.info(f"Sheet name not explicitly provided in request, using URL parameter '{sheet_name}'")
                            sheet_data_count = FileData.objects.filter(file=file, sheet=sheet_name).count()
                            logger.info(f"Found {sheet_data_count} rows to delete in sheet '{sheet_name}'")
                            FileData.objects.filter(file=file, sheet=sheet_name).delete()
                            
                        # Create new file data objects with sheet info
                        new_file_data = []
                        for row_data in file_data_rows:
                            new_file_data.append(FileData(file=file, data=row_data, sheet=sheet_name))
                        
                        logger.info(f"Creating {len(new_file_data)} new rows for sheet '{sheet_name}'")
                    else:
                        # For CSV or entire Excel file updates, we need to handle this differently
                        # First, let's retrieve all existing data for this file
                        if is_excel and sheet_name:
                            # For Excel files with a specific sheet, only delete and update that sheet
                            logger.info(f"Excel file with sheet '{sheet_name}': deleting only data for this sheet")
                            FileData.objects.filter(file=file, sheet=sheet_name).delete()
                            
                            # Create new file data objects only for the specified sheet
                            new_file_data = []
                            for row_data in file_data_rows:
                                new_file_data.append(FileData(file=file, data=row_data, sheet=sheet_name))
                        else:
                            # For CSV or entire Excel file without specific sheet, replace all
                            logger.info(f"Replacing all file data for file ID {file_id}")
                            
                            # For non-Excel files or Excel files without sheet specification
                            # We delete all existing data and replace with the new data
                            FileData.objects.filter(file=file).delete()
                            
                            # Create new file data objects
                            new_file_data = []
                            for row_data in file_data_rows:
                                new_file_data.append(FileData(file=file, data=row_data))
                    
                    # Bulk create the new data
                    created_data = FileData.objects.bulk_create(new_file_data)
                    
                    # Update the column order if provided
                    if column_order:
                        file.column_order = column_order
                        logger.info(f"Updated column order for file {file_id}: {column_order}")
                    
                    # Update file extras to ensure it's marked as data-driven-ready
                    file.extras['ddr'] = {
                        'data-driven-ready': True
                    }
                    file.save()
                    
                    logger.info(f"Successfully updated both database and file: {file.name}")
                    
                except subprocess.CalledProcessError as e:
                    stderr_output = e.stderr.decode('utf-8') if e.stderr else "No error output"
                    stdout_output = e.stdout.decode('utf-8') if e.stdout else "No standard output"
                    logger.error(f"GPG encryption command failed with code {e.returncode}")
                    logger.error(f"Error output: {stderr_output}")
                    logger.error(f"Standard output: {stdout_output}")
                    raise Exception(f"Failed to encrypt file: {stderr_output}")
                finally:
                    # Always clean up the temp file
                    if os.path.exists(temp_path):
                        try:
                            os.remove(temp_path)
                            logger.info(f"Removed temporary file: {temp_path}")
                        except Exception as cleanup_err:
                            logger.warning(f"Failed to remove temporary file: {cleanup_err}")
                
                # Send a websocket message to indicate the file was updated
                try:
                    requests.post(f'{get_cometa_socket_url()}/sendAction', json={
                        "type": "[Files] Updated",
                        "file": FileSerializer(file, many=False).data
                    })
                except Exception as ws_err:
                    logger.warning(f"Failed to send websocket notification: {ws_err}")
            
            # Outside the transaction.atomic() block, but we only get here if everything succeeded
            return JsonResponse({
                "success": True,
                "message": f"Successfully updated {len(created_data)} rows in file '{file.name}'.",
                "rows_updated": len(created_data)
            })
                    
        except Exception as err:
            logger.error(f"Error occurred while updating file data: {err}")
            logger.exception(err)
            return JsonResponse({
                "success": False,
                "error": str(err)
            }, status=200)

def dataDrivenExecution(request, row, ddr: DataDriven_Runs):
    data = row.data
    feature_id = data.get('feature_id', None)
    feature_name = data.get('feature_name', None)

    if not feature_id and not feature_name:
        raise Exception("Missing 'feature_id' and 'feature_name' in row.")

    try:
        feature = Feature.objects.get(pk=feature_id)
    except Feature.DoesNotExist:
        feature = Feature.objects.get(feature_name=feature_name)
    except:
        raise Exception("Feature not found.")
    
    additional_variables = [
        {
            'variable_name': k,
            'variable_value': v,
            'scope': 'data-driven'
        } for k,v in data.items()
    ]
    ddr.refresh_from_db()
    logger.debug(f"Checking ddr status {ddr}")
    if not ddr.running:
        return
    result = runFeature(request, feature.feature_id, additional_variables=additional_variables)
    
    if not result['success']:
        raise Exception("Feature execution failed: %s" % result['error'])
    
    feature_result_ids = result['feature_result_ids']
    logger.debug(f"Executions started with data driven run id {ddr.run_id} ")
    ddr.feature_results.add(*feature_result_ids)

    MAX_EXECUTION_TIMEOUT=7500
    start = time.time()

    for feature_result_id in feature_result_ids:
        while True:
            try:
                fr = Feature_result.objects.get(pk=feature_result_id)
                ddr.refresh_from_db()  # Refresh data from DB if it DDT was stopped in between  
                if fr.running and (time.time() - start) < MAX_EXECUTION_TIMEOUT and ddr.running:
                    logger.debug(f"Feature Result {fr.feature_result_id} is still running, will wait for it.")
                    time.sleep(10)
                else:
                    break
            except Feature_result.DoesNotExist:
                raise Exception(f'Feature Result with id {feature_result_id} probably failed.')
            
        # add feature result data to the ddr
        if fr:
            ddr.total += fr.total
            ddr.ok += fr.ok
            ddr.fails += fr.fails
            ddr.skipped += fr.skipped
            ddr.pixel_diff += fr.pixel_diff
            ddr.execution_time += fr.execution_time
            ddr.save()

            # Send incremental progress update to WebSocket with user context
            try:
                user = request.session.get('user', {})
                progress_payload = {
                    "running": True,
                    "status": "Running",
                    "total": ddr.total,
                    "ok": ddr.ok,
                    "fails": ddr.fails,
                    "skipped": ddr.skipped,
                    "execution_time": ddr.execution_time,
                    "pixel_diff": ddr.pixel_diff,
                    "user_id": user.get('user_id'),
                    "department_id": ddr.file.department_id
                }
                
                logger.info(f"[DATA-DRIVEN PROGRESS] Sending progress update for run {ddr.run_id} - Total: {ddr.total}, OK: {ddr.ok}, Fails: {ddr.fails}, User: {user.get('user_id')}")
                
                progress_response = requests.post(f'{get_cometa_socket_url()}/dataDrivenStatus/{ddr.run_id}', progress_payload)
                if progress_response.status_code != 200:
                    logger.error(f"[DATA-DRIVEN PROGRESS] Failed to send progress update for run {ddr.run_id}: {progress_response.status_code} - {progress_response.text}")
                else:
                    logger.debug(f"[DATA-DRIVEN PROGRESS] Progress update sent successfully for run {ddr.run_id}")
            except Exception as e:
                logger.error(f"[DATA-DRIVEN PROGRESS] Exception sending progress update: {e}")

def startDataDrivenRun(request, rows: list[FileData], ddr: DataDriven_Runs, lock_identifier: str):
    user = request.session['user']
    origin = request.META.get('HTTP_COMETA_ORIGIN', 'MANUAL')
    logger.info(f"[DATA-DRIVEN THREAD] Starting Data Driven Test {user['name']} (ID: {user['user_id']}) - Run: {ddr.run_id}, Origin: {origin}, Rows: {len(rows)}")
    
    try:
        # This executes one row data at a time with selected browsers 
        with ThreadPoolExecutor(max_workers=1) as executor:
            futures = []
            
            for row in rows:
                futures.append(executor.submit(dataDrivenExecution, request, row, ddr))
            
            for future in as_completed(futures):
                try:
                    ddr.refresh_from_db()
                    logger.debug(f"Checking on ddr status {ddr}")
                    if not ddr.running:
                        executor.shutdown(wait=False,cancel_futures=True)
                        break

                except (TimeoutError, ThreadPoolExecutor) as exception:
                    logger.exception(exception)

                try:
                    logger.info(future.result())
                except Exception as err:
                    logger.exception(err)

    except Exception as exception:
        logger.exception(exception)
    finally:
        # Always release the file lock when DDT completes, regardless of success/failure
        file_id_for_queue = ddr.file_id  # Store for queue processing
        try:
            if lock_identifier and ddr.file_id:
                file_lock_manager.release_file_lock(ddr.file_id, lock_identifier)
                logger.info(f"[DATA-DRIVEN COMPLETION] Released lock for file {ddr.file_id} with identifier {lock_identifier}")
                
                # Process any queued DDT runs for this file
                try:
                    process_queued_ddt_runs(file_id_for_queue)
                except Exception as queue_error:
                    logger.error(f"[DATA-DRIVEN COMPLETION] Error processing queued DDT runs for file {file_id_for_queue}: {queue_error}")
                    
        except Exception as lock_error:
            logger.error(f"[DATA-DRIVEN COMPLETION] Failed to release lock for file {ddr.file_id}: {lock_error}")
    
    # Update when test completed (If stopped or completed in both cases) 
    ddr.refresh_from_db()
    ddr.running = False
    if ddr.status != 'Terminated': 
        ddr.status = 'Failed' if ddr.fails > 0 else 'Passed'
    ddr.save()
    # Update to cometa Socket with user context
    user = request.session.get('user', {})
    final_payload = {
        "running": False,
        "status": ddr.status,
        "total": ddr.total,
        "ok": ddr.ok,
        "fails": ddr.fails,
        "skipped": ddr.skipped,
        "execution_time": ddr.execution_time,
        "pixel_diff": ddr.pixel_diff,
        "user_id": user.get('user_id'),
        "department_id": ddr.file.department_id
    }
    
    logger.info(f"[DATA-DRIVEN COMPLETION] Sending final status for run {ddr.run_id} - Status: {ddr.status}, Total: {ddr.total}, OK: {ddr.ok}, Fails: {ddr.fails}, User: {user.get('user_id')}")
    
    response = requests.post(f'{get_cometa_socket_url()}/dataDrivenStatus/{ddr.run_id}', final_payload)
    if response.status_code != 200:
        logger.error(f"[DATA-DRIVEN COMPLETION] Failed to send final status: {response.status_code} - {response.text}")
        raise Exception("Not able to connect cometa_socket")
    else:
        logger.info(f"[DATA-DRIVEN COMPLETION] Final status sent successfully for run {ddr.run_id}")

@csrf_exempt
@require_subscription()
@require_permissions("run_feature")
def runDataDriven(request, *args, **kwargs):
    # Log the execution source and user context
    user = request.session.get('user', {})
    origin = request.META.get('HTTP_COMETA_ORIGIN', 'MANUAL')
    logger.info(f"[DATA-DRIVEN EXECUTION] Starting data-driven test - Origin: {origin}, User: {user.get('name', 'Unknown')} (ID: {user.get('user_id', 'Unknown')})")
    
    # Verify body can be parsed as JSON
    try:
        data = json.loads(request.body)
    except json.JSONDecodeError:
        return JsonResponse({ 'success': False, 'error': 'Unable to parse request body.' }, status=200)
    
    file_id = data.get('file_id', None)
    if not file_id:
        logger.error(f"[DATA-DRIVEN EXECUTION] No file_id provided in request - Origin: {origin}")
        return JsonResponse({ 'success': False, 'error': 'Missing \'file_id\' parameter.' }, status=200)
    
    logger.info(f"[DATA-DRIVEN EXECUTION] Processing file_id: {file_id} - Origin: {origin}")
    user_departments = GetUserDepartments(request)
    # User security added
    try:
        file = File.objects.prefetch_related('file').get(pk=file_id, department__in=user_departments)
    except File.DoesNotExist:
        return JsonResponse({
            "success": False,
            "error": "File not found."
        }, status=200)
    
    file_data = file.file.all()

    if len(file_data) == 0:
        return JsonResponse({
            "success": False,
            "error": "No rows found for selected data driven file."
        }, status=200)
    
    # --- BEGIN VALIDATION --- 
    missing_features = []
    for index, row_data_obj in enumerate(file_data):
        row_content = row_data_obj.data
        feature_id = row_content.get('feature_id', None)
        feature_name = row_content.get('feature_name', None)

        if not feature_id and not feature_name:
            return JsonResponse({
                'success': False,
                'error': f'Row {index + 1}: Missing \'feature_id\' or \'feature_name\'.'
            }, status=200)
        
        feature_exists = False
        try:
            if feature_id:
                if Feature.objects.filter(pk=feature_id).exists():
                    feature_exists = True
            if not feature_exists and feature_name: # Check name only if ID didn't exist or wasn't provided
                 if Feature.objects.filter(feature_name=feature_name).exists():
                     feature_exists = True
        except Exception as e: # Catch potential errors during lookup (e.g., invalid ID format)
             logger.warning(f"Error looking up feature in row {index + 1}: {e}")
             # Treat lookup errors as missing features for safety
             feature_exists = False 

        if not feature_exists:
            missing_identifier = feature_id if feature_id else feature_name
            missing_features.append(f"Row {index + 1} (Feature: '{missing_identifier}')")

    if missing_features:
        error_message = "File cannot be executed. The following referenced features do not exist: " + ", ".join(missing_features)
        return JsonResponse({
            'success': False,
            'error': error_message
        }, status=200)
    # --- END VALIDATION ---
    
    # --- BEGIN FILE LOCKING ---
    # Acquire file lock to prevent concurrent DDT execution on the same file
    # Use instant timeout (0 seconds) for immediate queuing without delay
    lock_identifier = None
    try:
        lock_identifier = file_lock_manager.acquire_file_lock(file_id, timeout=0)
        if not lock_identifier:
            # Check if file is already being processed
            lock_info = file_lock_manager.get_lock_info(file_id)
            if lock_info:
                logger.info(f"[DATA-DRIVEN EXECUTION] File {file_id} is locked by {lock_info['holder']}, checking queue - Origin: {origin}")
                
                # Check if there are already too many queued runs for this file
                existing_queued = DataDriven_Runs.objects.filter(
                    file_id=file_id,
                    status="Queued",
                    running=False
                ).count()
                
                max_queue_size = 3  # Allow max 3 queued runs per file
                if existing_queued >= max_queue_size:
                    logger.warning(f"[DATA-DRIVEN EXECUTION] Too many queued runs ({existing_queued}) for file {file_id} - Origin: {origin}")
                    return JsonResponse({
                        'success': False,
                        'error': f'Too many queued tests for file {file.name}. Maximum {max_queue_size} tests can be queued per file.',
                        'code': 'QUEUE_FULL',
                        'queued_count': existing_queued
                    }, status=200)
                
                # Create a queued DDT run instead of returning an error
                # Store the user who initiated this run for proper budget checks and permissions
                user = request.session.get('user', {})
                queued_ddr = DataDriven_Runs(
                    file_id=file_id, 
                    running=False, 
                    status="Queued",
                    lock_identifier=None,  # No lock yet, will be acquired when it starts
                    initiated_by_id=user.get('user_id')
                )
                queued_ddr.save()
                
                logger.info(f"[DATA-DRIVEN EXECUTION] Created queued DataDriven_Runs record {queued_ddr.run_id} for file {file.name} - Origin: {origin}, User: {user.get('name', 'Unknown')}")
                
                # Send WebSocket message for queued status
                socket_payload = {
                    "running": False,
                    "status": "Queued",
                    "run_id": queued_ddr.run_id,
                    "file_id": file_id,
                    "message": f"Data-driven test queued. File {file.name} is currently being processed by another run.",
                    "user_name": user.get('name', 'Unknown'),
                    "user_id": user.get('user_id', 'Unknown'),
                    "origin": origin
                }
                
                try:
                    # Send WebSocket notification
                    response = requests.post(f'{get_cometa_socket_url()}/dataDrivenStatus/{queued_ddr.run_id}', socket_payload)
                    if response.status_code == 200:
                        logger.debug(f"[DATA-DRIVEN EXECUTION] Sent queued WebSocket message for run {queued_ddr.run_id}")
                    else:
                        logger.warning(f"[DATA-DRIVEN EXECUTION] Failed to send queued WebSocket message: {response.status_code} - {response.text}")
                except Exception as ws_error:
                    logger.warning(f"[DATA-DRIVEN EXECUTION] Failed to send queued WebSocket message: {ws_error}")
                
                return JsonResponse({
                    'success': True,
                    'message': f'Data-driven test was queued. File {file.name} is currently being processed.',
                    'status': 'queued',
                    'run_id': queued_ddr.run_id,
                    'show_snackbar': True,  # Signal frontend to show snackbar
                    'snackbar_message': f'Data driven test was queued for file {file.name}',
                    'lock_info': {
                        'holder': lock_info['holder'],
                        'expires_in_seconds': lock_info['ttl']
                    }
                }, status=200)
            else:
                logger.error(f"[DATA-DRIVEN EXECUTION] Unable to acquire lock for file {file_id} - Origin: {origin}")
                return JsonResponse({
                    'success': False,
                    'error': 'Unable to acquire lock for file processing. Please try again in a moment.',
                    'code': 'LOCK_ACQUISITION_FAILED'
                }, status=200)
        
        logger.info(f"[DATA-DRIVEN EXECUTION] Acquired lock for file {file_id} with identifier {lock_identifier} - Origin: {origin}")
        
    except FileLockAcquisitionError as e:
        logger.error(f"[DATA-DRIVEN EXECUTION] File lock acquisition error for file {file_id}: {e} - Origin: {origin}")
        return JsonResponse({
            'success': False,
            'error': 'System error during lock acquisition. Please try again.',
            'code': 'LOCK_SYSTEM_ERROR'
        }, status=200)
    except Exception as e:
        logger.error(f"[DATA-DRIVEN EXECUTION] Unexpected error during file lock acquisition for file {file_id}: {e} - Origin: {origin}")
        return JsonResponse({
            'success': False,
            'error': 'Unexpected system error. Please try again.',
            'code': 'UNEXPECTED_ERROR'
        }, status=200)
    # --- END FILE LOCKING ---
    
    try:
        # Store the user who initiated this run for proper budget checks and permissions
        user = request.session.get('user', {})
        ddr = DataDriven_Runs(
            file_id=file_id, 
            running=True, 
            status="Running", 
            lock_identifier=lock_identifier,
            initiated_by_id=user.get('user_id')
        )
        ddr.save()
        
        logger.info(f"[DATA-DRIVEN EXECUTION] Created DataDriven_Runs record {ddr.run_id} for file {file.name} - Origin: {origin}, User: {user.get('name', 'Unknown')}")
        
        # Send initial WebSocket message with user context
        socket_payload = {
            "running": True,
            "status": "Running",
            "total": 0,
            "ok": 0,
            "fails": 0,
            "skipped": 0,
            "execution_time": 0,
            "pixel_diff": 0,
            "user_id": user.get('user_id'),
            "department_id": file.department_id
        }
        
        logger.info(f"[DATA-DRIVEN EXECUTION] Sending initial WebSocket message for run {ddr.run_id} - User: {user.get('user_id')}, Department: {file.department_id}")
        
        response = requests.post(f'{get_cometa_socket_url()}/dataDrivenStatus/{ddr.run_id}', socket_payload)
        if response.status_code != 200:
            logger.error(f"[DATA-DRIVEN EXECUTION] Failed to send initial WebSocket message: {response.status_code} - {response.text}")
        else:
            logger.info(f"[DATA-DRIVEN EXECUTION] Initial WebSocket message sent successfully for run {ddr.run_id}")
        # Spawn thread to launch feature run with lock identifier
        t = Thread(target=startDataDrivenRun, args=(request, file_data, ddr, lock_identifier))
        t.start()

        return JsonResponse({ 'success': True, 'run_id': ddr.pk })
    except Exception as e:
        # Release lock on error during DDR creation or thread spawning
        if lock_identifier:
            try:
                file_lock_manager.release_file_lock(file_id, lock_identifier)
                logger.info(f"[DATA-DRIVEN EXECUTION] Released lock for file {file_id} due to error: {e} - Origin: {origin}")
            except Exception as lock_error:
                logger.error(f"[DATA-DRIVEN EXECUTION] Failed to release lock for file {file_id} after error: {lock_error} - Origin: {origin}")
        
        return JsonResponse({ 'success': False, 'error': str(e) })
    
@csrf_exempt
@require_subscription()
@require_permissions("run_feature")
@require_http_methods(["POST"])
def stop_data_driven_test(request, *args, **kwargs):  
    run_id = kwargs.get('run_id', None)
    if not run_id:
        return JsonResponse({ 'success': False, 'error': 'Missing \'run_id\'' }, status=200)

    # User security added
    user_departments = GetUserDepartments(request)
    try:
        data_driven_run = DataDriven_Runs.objects.get(run_id=run_id)
    except DataDriven_Runs.DoesNotExist:
        return JsonResponse({
            "success": False,
            "error": f"data driven run not found with id : {run_id}"
        }, status=200)
    # Get all feature results ID
    feature_results = data_driven_run.feature_results.all()

    # User security added
    if len(feature_results)>0 and feature_results[0].department_id not in user_departments:
         return JsonResponse({ 'success': False, 'error': 'You do not have access to this department' }, status=200)

    # Get all task ID which are running feature with different browsers and test data
    tasks = Feature_Task.objects.filter(feature_result_id__in=feature_results)

    try:    
        logger.debug(f"Found total {len(tasks)} tasks related to data driven run id : {run_id}")
        for task in tasks:
            task.feature_result_id.running = False
            task.feature_result_id.save()
            response = requests.get(f'{get_cometa_behave_url()}/kill_task/' + str(task.pid) + "/")
            logger.debug(f"Killing Task with id {task.task_id}")
            task.delete()
        
        
        if len(tasks) > 0:
            # Force state of stopped for current feature in WebSocket Server
            response = requests.post(f'{get_cometa_socket_url()}/dataDrivenStatus/{run_id}',{
                "running": False,
                "status": "Terminated",
                "total": data_driven_run.total,
                "ok": data_driven_run.ok,
                "fails": data_driven_run.fails,
                "skipped": data_driven_run.skipped,
                "execution_time": data_driven_run.execution_time,
                "pixel_diff": data_driven_run.pixel_diff
            })
            if response.status_code != 200 :
                raise Exception("Not able to connect cometa_socket")

        # Force state of stopped for current feature in WebSocket Server
        data_driven_run.running = False
        data_driven_run.status = "Terminated"
        data_driven_run.save()
        
        # Release file lock when DDT is manually stopped
        if data_driven_run.lock_identifier and data_driven_run.file_id:
            file_id_for_queue = data_driven_run.file_id  # Store for queue processing
            try:
                file_lock_manager.release_file_lock(data_driven_run.file_id, data_driven_run.lock_identifier)
                logger.info(f"[DATA-DRIVEN STOP] Released lock for file {data_driven_run.file_id} after manual stop of run {run_id}")
                
                # Process any queued DDT runs for this file after manual stop
                try:
                    process_queued_ddt_runs(file_id_for_queue)
                except Exception as queue_error:
                    logger.error(f"[DATA-DRIVEN STOP] Error processing queued DDT runs for file {file_id_for_queue}: {queue_error}")
                    
            except Exception as lock_error:
                logger.error(f"[DATA-DRIVEN STOP] Failed to release lock for file {data_driven_run.file_id} after manual stop: {lock_error}")

        return JsonResponse({"success": True, "tasks": len(tasks),"run_id":run_id}, status=200)

    except Exception as e:
        logger.exception(e)
        return JsonResponse({"success": False, "tasks": len(tasks)}, status=200)