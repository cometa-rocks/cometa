# Import all models and all the utility methods

from rest_framework.renderers import JSONRenderer
from rest_framework.response import Response
from rest_framework import viewsets, filters, generics, status
# Django Imports
from django.http import HttpResponse, JsonResponse
from .models import HouseKeepingLogs

from .house_keeping import FileSelector

class HouseKeeping(viewsets.ModelViewSet):
    queryset = HouseKeepingLogs.objects.none()
    # serializer_class = FileSerializer
    # renderer_classes = (JSONRenderer,)

    def list(self, request, *args, **kwargs):
        return JsonResponse({'success': True})        

    def get(self, request, *args, **kwargs):
        return JsonResponse({'success': True})        

    def put(self, request, *args, **kwargs):
        return JsonResponse({'success': True})

    def create(self, request):
        # get the department_id from the request
        return JsonResponse({'success': True})
      
    def delete(self, request, *args, **kwargs):
        file_selector = FileSelector()
        file_selector.select_files()
        return JsonResponse({'success': False, 'error': 'File does not exists.'})
     
    # # This method is not use when creating feature
    # @require_permissions("create_feature")
    # def create(self, request, *args, **kwargs):
    #     """
    #     Verify access to submitted browsers
    #     """
    #     try:
    #         subscriptions = get_subscriptions_from_request(request)
    #         check_browser_access(request.data['browsers'] or [], subscriptions)
    #     except Exception as err:
    #         return JsonResponse({'success': False, 'error': str(err)})

    #     """
    #     Create feature with POST data
    #     """
    #     newFeature = Feature(
    #         feature_name=request.data['feature_name'],
    #         app_id=request.data['app_id'],
    #         app_name=request.data['app_name'],
    #         description=request.data['description'],
    #         environment_id=request.data['environment_id'],
    #         environment_name=request.data['environment_name'],
    #         steps=len([x for x in request.data['steps']['steps_content'] if x['enabled'] == True]),
    #         # schedule = request.data['schedule'], # Handle it later, we need to validate it
    #         department_id=request.data['department_id'],
    #         department_name=request.data['department_name'],
    #         screenshot="",  # ! Deprecated: now each step has it's own screenshot value
    #         compare="",  # ! Deprecated: now each step has it's own compare value
    #         depends_on_others=False if 'depends_on_others' not in request.data else (
    #             False if request.data['depends_on_others'] == None else request.data['depends_on_others']),
    #         browsers=request.data['browsers'],
    #         cloud=request.data['cloud'],
    #         video=request.data['video'],
    #         network_logging=request.data.get('network_logging', False),
    #         generate_dataset=request.data.get('generate_dataset', False),
    #         continue_on_failure=request.data.get('continue_on_failure', False),
    #         last_edited_id=request.session['user']['user_id'],
    #         last_edited_date=datetime.datetime.utcnow(),
    #         created_by_id=request.session['user']['user_id']
    #     )
 
    #     """
    #     Save feature object into DB while also saving new steps
    #     """
    #     newFeature.save(steps=request.data['steps']['steps_content'])

    #     """
    #     Process schedule if requested
    #     """
    #     if 'schedule' in request.data:
    #         try:
    #             schedule_update(newFeature.pk, request.data['schedule'], request.session['user']['user_id'])
    #         except Exception as err:
    #             logger.error("Unable to save the schedule...")
    #             logger.exception(err)

    #     # ??? returnResult = Feature.objects.filter(feature_id=newFeature.feature_id) # FIXME: Why this line?
    #     return Response(FeatureSerializer(newFeature, many=False, context={"from": "folder"}).data, status=201)

    # @require_permissions("edit_feature")
    # def patch(self, request, *args, **kwargs):
    #     # This REST endpoint allows to edit feature by just sending
    #     # the feature id and a partial object definition of Feature
    #     # Get JSON payload
    #     data = json.loads(request.body)
    #     # Get feature id from body
    #     featureId = data.get('feature_id', 0)

    #     """
    #     Edit or Create Feature
    #     """
    #     if int(featureId) != 0:
    #         # Retrieve feature info by id
    #         features = Feature.objects.filter(feature_id=featureId)
    #         # Check if requested feature exists
    #         if not features.exists():
    #             return JsonResponse({"success": False, "error": "Feature not found"})
    #         feature = features[0]
    #         # Retrieve feature path details
    #         feature_dir = get_feature_path(featureId)
    #     else:
    #         # Create new feature
    #         feature = Feature()

    #     """
    #     Verify access to submitted browsers
    #     """
    #     try:
    #         subscriptions = get_subscriptions_from_request(request)
    #         check_browser_access(data.get('browsers', []), subscriptions)
    #     except Exception as err:
    #         return JsonResponse({'success': False, 'error': str(err)})

    #     """
    #     Merge fields of feature model with values from body payload
    #     """
    #     # Retrieve feature model fields
    #     fields = feature._meta.get_fields()
    #     # Make some exceptions
    #     exceptions = ['feature_id', 'schedule']
    #     # Iterate over each field of model
    #     for field in fields:
    #         # Check if the field exists in data payload
    #         if field.name in data and field.name not in exceptions:
    #             # Set value into model field with default to previous value
    #             setattr(feature, field.name, data.get(field.name, getattr(feature, field.name)))

    #     """
    #     Update last edited fields
    #     """
    #     feature.last_edited_id = request.session['user']['user_id']
    #     feature.last_edited_date = datetime.datetime.utcnow()

    #     """
    #     Save submitted feature steps
    #     """
    #     # Save feature into database
    #     if 'steps' in data and 'steps_content' in data.get('steps', {}):
    #         # Save with steps
    #         steps = data['steps']['steps_content'] or []
    #         feature.steps = len([x for x in steps if x['enabled'] == True])
    #         result = feature.save(steps=steps)
    #     else:
    #         # Save without steps
    #         result = feature.save()

    #     """
    #     Process schedule if requested
    #     """
    #     if 'schedule' in data:
    #         try:
    #             newSchedule = schedule_update(feature.pk, data['schedule'], request.session['user']['user_id'])
    #             feature.schedule = newSchedule
    #         except Exception as err:
    #             logger.error("Unable to save the schedule...")
    #             logger.exception(err)

    #     """
    #     Send WebSockets
    #     """
    #     # Add the updated feature to the result if feature save was ok
    #     if result['success']:
    #         result['info'] = FeatureSerializer(feature, many=False).data
    #         requests.post('http://cometa_socket:3001/sendAction', json={
    #             'type': '[Features] Update feature offline',
    #             'feature': result['info'],
    #             'exclude': [request.session['user']['user_id']]
    #         })
    #         requests.post('http://cometa_socket:3001/sendAction', json={
    #             'type': '[Features] Get Folders',
    #             'exclude': [request.session['user']['user_id']]
    #         })

    #     # Spawn thread to send help email about 'Ask for help'
    #     t = Thread(target=SendHelpEmail, args=(request, feature,))
    #     t.start()

    #     return JsonResponse(result, status=200)

    # def run_test(self, json_path):
    #     post_data = {'json_path': json_path}
    #     response = requests.post('http://behave:8001/run_test/', data=post_data)
    #     return response.status_code

    # @require_permissions("delete_feature", feature_id="kwargs['feature_id']")
    # def delete(self, request, *args, **kwargs):
        # get the feature id from the url GET parameters
        feature_id = self.kwargs['feature_id']
        # get the feature from the database
        features = Feature.objects.filter(feature_id=feature_id)
        # check if feature exists with id found in url
        if not features.exists():
            return JsonResponse({"success": False, "error": "Feature_id invalid or doesn't exist."}, status=400)
        # get the feature from the array
        feature = features[0]
        # find feature runs not marked as archive related to the feature
        feature_runs = feature.feature_runs.filter(archived=False)
        # loop over all the feature_runs found
        for feature_run in feature_runs:
            # remove all feature_results not marked as archived from the feature_run
            removeNotArchivedFeatureResults(feature_run, deleteTemplate=True)
            # check if feature_run contains any feature_results if so do not delete it else do so
            if len(feature_run.feature_results.all()) == 0:
                feature_run.delete()
        # remove feature steps
        Step.objects.filter(feature_id=feature_id).delete()
        # Delete files in disk (not backups!)
        featureFileName = get_feature_path(features[0])['fullPath']
        try:
            os.remove(featureFileName + '.feature')
            os.remove(featureFileName + '.json')
            os.remove(featureFileName + '_meta.json')
        except OSError:
            pass
        # Delete feature if feature_runs count is == 0 else don't since it contains archived data
        if len(feature.feature_runs.all()) == 0:
            feature.delete()
        else:
            return JsonResponse({'success': False,
                                 'error': 'Feature is not fully deleted since it contains SAVED results, to remove it completely please remove SAVED runs and results.'})
        return JsonResponse({"success": True}, status=200)

