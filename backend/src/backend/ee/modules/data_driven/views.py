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
import requests
from backend.utility.config_handler import *

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
            }, status=400)
        try:
            ddr = DataDriven_Runs.objects.prefetch_related('feature_results').get(pk=run_id, file__department_id__in=user_departments)
        except DataDriven_Runs.DoesNotExist:
            return JsonResponse({
                'success': False,
                'error': 'Data Driven Run not found.'
            }, status=404)

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
                }, status=404)
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
                return JsonResponse({'success': False, 'error': 'Invalid department_id parameter.'}, status=400)

        # Get file_id from query parameters
        file_id = request.GET.get('file_id', None)
        if file_id:
            try:
                # Attempt to convert to integer and filter
                file_id_int = int(file_id)
                ddrs = ddrs.filter(file_id=file_id_int)
            except (ValueError, TypeError):
                return JsonResponse({'success': False, 'error': 'Invalid file_id parameter.'}, status=400)
        
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
            }, status=400)

        try:
            ddr = DataDriven_Runs.objects.get(pk=run_id, file__department__in=GetUserDepartments(request))
        except DataDriven_Runs.DoesNotExist:
            return JsonResponse({
                'success': False,
                'error': 'Run not found.'
            }, status=404)
        
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
            }, status=404)
        
        # get user departments
        user_departments = GetUserDepartments(request)
        if file.department.department_id not in user_departments:
            return JsonResponse({
                "success": False,
                "error": "You do not have access to this object."
            }, status=403)
        
        # file.all() comes from the reverse relation between FileData and File model.
        file_data = file.file.all()

        if reparse or not file_data:
            # delete any old data only works incase of reparse
            file_data.delete()
            try:
                # parse file data
                file_data = getFileContent(file)
                file.save()
            except Exception as err:
                return JsonResponse({
                    "success": False,
                    "error": str(err) 
                }, status=400)
        
        # paginate the queryset
        page = self.paginate_queryset(file_data)
        # serialize the paginated data
        serialized_data = FileDataSerializer(page, many=True).data
        # return data to the user
        return self.get_paginated_response(serialized_data)
    
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

            # Send incremental progress update to WebSocket
            try:
                progress_response = requests.post(f'{get_cometa_socket_url()}/dataDrivenStatus/{ddr.run_id}',{
                    "running": True,
                    "status": "Running",
                    "total": ddr.total,
                    "ok": ddr.ok,
                    "fails": ddr.fails,
                    "skipped": ddr.skipped,
                    "execution_time": ddr.execution_time,
                    "pixel_diff": ddr.pixel_diff
                })
                if progress_response.status_code != 200:
                    logger.error(f"Failed to send incremental progress update for run {ddr.run_id}")
            except Exception as e:
                logger.error(f"Exception sending incremental progress update: {e}")

def startDataDrivenRun(request, rows: list[FileData], ddr: DataDriven_Runs):
    user = request.session['user']
    logger.info(f"Starting Data Driven Test {user['name']}")
    
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
    
    # Update when test completed (If stopped or completed in both cases) 
    ddr.refresh_from_db()
    ddr.running = False
    if ddr.status != 'Terminated': 
        ddr.status = 'Failed' if ddr.fails > 0 else 'Passed'
    ddr.save()
    # Update to cometa Socket
    response = requests.post(f'{get_cometa_socket_url()}/dataDrivenStatus/{ddr.run_id}',{
        "running": False,
        "status": ddr.status,
        "total": ddr.total,
        "ok": ddr.ok,
        "fails": ddr.fails,
        "skipped": ddr.skipped,
        "execution_time": ddr.execution_time,
        "pixel_diff": ddr.pixel_diff
    })
    if response.status_code != 200 :
        raise Exception("Not able to connect cometa_socket")

@csrf_exempt
@require_subscription()
@require_permissions("run_feature")
def runDataDriven(request, *args, **kwargs):
    # Verify body can be parsed as JSON
    try:
        data = json.loads(request.body)
    except json.JSONDecodeError:
        return JsonResponse({ 'success': False, 'error': 'Unable to parse request body.' }, status=400)
    
    file_id = data.get('file_id', None)
    if not file_id:
        return JsonResponse({ 'success': False, 'error': 'Missing \'file_id\' parameter.' }, status=400)
    user_departments = GetUserDepartments(request)
    # User security added
    try:
        file = File.objects.prefetch_related('file').get(pk=file_id, department__in=user_departments)
    except File.DoesNotExist:
        return JsonResponse({
            "success": False,
            "error": "File not found."
        }, status=404)
    
    file_data = file.file.all()

    if len(file_data) == 0:
        return JsonResponse({
            "success": False,
            "error": "No rows found for selected data driven file."
        }, status=400)
    
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
            }, status=400)
        
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
        }, status=400)
    # --- END VALIDATION ---

    try:
        ddr = DataDriven_Runs(file_id=file_id, running=True, status="Running")
        ddr.save()
        requests.post(f'{get_cometa_socket_url()}/dataDrivenStatus/{ddr.run_id}',{
            "running": True,
            "status": "Running",
            "total": 0,
            "ok": 0,
            "fails": 0,
            "skipped": 0,
            "execution_time": 0,
            "pixel_diff": 0
        })
        # Spawn thread to launch feature run
        t = Thread(target=startDataDrivenRun, args=(request, file_data, ddr))
        t.start()

        return JsonResponse({ 'success': True, 'run_id': ddr.pk })
    except Exception as e:
        return JsonResponse({ 'success': False, 'error': str(e) })
    
@csrf_exempt
@require_subscription()
@require_permissions("run_feature")
@require_http_methods(["POST"])
def stop_data_driven_test(request, *args, **kwargs):  
    run_id = kwargs.get('run_id', None)
    if not run_id:
        return JsonResponse({ 'success': False, 'error': 'Missing \'run_id\'' }, status=400)

    # User security added
    user_departments = GetUserDepartments(request)
    try:
        data_driven_run = DataDriven_Runs.objects.get(run_id=run_id)
    except DataDriven_Runs.DoesNotExist:
        return JsonResponse({
            "success": False,
            "error": f"data driven run not found with id : {run_id}"
        }, status=404)
    # Get all feature results ID
    feature_results = data_driven_run.feature_results.all()

    # User security added
    if len(feature_results)>0 and feature_results[0].department_id not in user_departments:
         return JsonResponse({ 'success': False, 'error': 'You do not have access to this department' }, status=400)

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

        return JsonResponse({"success": True, "tasks": len(tasks),"run_id":run_id}, status=200)

    except Exception as e:
        logger.exception(e)
        return JsonResponse({"success": False, "tasks": len(tasks)}, status=500)