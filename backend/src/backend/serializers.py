from rest_framework import serializers
from backend.models import *
import json, requests, logging, time, functools
from .mixins import *
from .common import *
from django.http import JsonResponse
import secret_variables
from pprint import pprint
from django.conf import settings
from django.db.models import Sum
from backend.payments import get_user_subscriptions, get_requires_payment
from backend.utility.functions import getLogger

# logger information
logger = getLogger()

##################################
# OIDC Account model serializers #
##################################
class OIDCAccountSerializer(serializers.ModelSerializer):

    departments = serializers.SerializerMethodField()
    permission_name = serializers.SerializerMethodField()
    created_on = serializers.DateTimeField(format=datetimeTZFormat)
    last_login = serializers.DateTimeField(format=datetimeTZFormat)

    class Meta:
        model = OIDCAccount
        depth = 2
        exclude = ('user_permissions','favourite_browsers', 'settings',)

    def create(self, validated_data):
        # create a new account
        new_user = OIDCAccount.objects.create(**validated_data)
        # give user access to Default department
        defaultDepartment = Department.objects.filter(department_name="Default")[0]
        user_department = Account_role(user=new_user, department=defaultDepartment)
        user_department.save()
        # send a websocket to front about the creation
        response = requests.post('http://cometa_socket:3001/sendAction', json={
            'type': '[Accounts] Add Account',
            'account': IAccount(new_user, many=False).data
        })

        return new_user

    def get_permission_name(self, instance):
        return instance.user_permissions.permission_name

    def get_departments(self, instance):
        return [x[0] for x in Account_role.objects.filter(user=instance).values_list('department')]

class OIDCAccountLoginSerializer(serializers.ModelSerializer):

    permissions = serializers.SerializerMethodField()
    clouds = serializers.SerializerMethodField()
    departments = serializers.SerializerMethodField()
    step_keywords = serializers.SerializerMethodField()
    encryption_prefix = serializers.SerializerMethodField()
    created_on = serializers.DateTimeField(format=datetimeTZFormat)
    last_login = serializers.DateTimeField(format=datetimeTZFormat)
    login_counter = serializers.IntegerField()
    integration_apps = serializers.SerializerMethodField()
    subscriptions = serializers.SerializerMethodField()
    requires_payment = serializers.SerializerMethodField()
    feedback_mail = serializers.SerializerMethodField()

    class Meta:
        model = OIDCAccount
        depth = 2
        fields = '__all__'

    def get_feedback_mail(self, instance):
        return getattr(secret_variables, 'COMETA_FEEDBACK_MAIL', '')

    def get_integration_apps(self, instance):
        return [x[1] for x in IntegrationApplications]

    def get_permissions(self, instance: OIDCAccount):
        results = Permissions.objects.filter(permission_power__lte=instance.user_permissions.permission_power)
        return [x[0] for x in results.values_list("permission_name")]

    def get_clouds(self, instance):
        results = Cloud.objects.all()
        return CloudSerializer(results, many=True).data

    def get_departments(self, instance):
        results = Department.objects.filter(department_id__in=Account_role.objects.filter(user=instance).values_list('department'))
        return DepartmentSerializer(results, many=True).data

    def get_requires_payment(self, instance):
        return get_requires_payment()

    def get_subscriptions(self, instance):
        return get_user_subscriptions(instance)

    def get_step_keywords(self, instance):
        return [x[0] for x in step_keywords]

    def get_encryption_prefix(self, instance):
        # Expose AES Encryption prefix, Front needs some way to know a text is encrypted
        # Exposing the prefix is not a security problem as explained below
        # https://crypto.stackexchange.com/questions/18158/does-having-a-known-plaintext-prefix-weaken-aes256/18160
        return getattr(secret_variables, 'COMETA_ENCRYPTION_START', '')

class BasicOIDCAccountLoginSerializer(serializers.ModelSerializer):
    class Meta:
        model = OIDCAccount
        fields = ['user_id', 'name', 'email', 'settings']

class BasicOIDCAccountSerializer(serializers.ModelSerializer):
    class Meta:
        model = OIDCAccount
        fields = ['user_id', 'name', 'email']

class OIDCAccountJsonSerializer(serializers.ModelSerializer):
    class Meta:
        model = OIDCAccount
        fields = '__all__'

class BasicOIDCAccountSerializer_WithoutUserID(serializers.ModelSerializer):
    class Meta:
        model = OIDCAccount
        fields = ['name', 'email']


################################
# Permissions model serializer #
################################
class PermissionsSerializer(serializers.ModelSerializer):
    class Meta:
        model = Permissions
        fields = '__all__'

###########################
# Cloud model serializers #
###########################
class CloudSerializer(serializers.ModelSerializer):
    class Meta:
        model = Cloud
        fields = '__all__'

#####################################
# Feature Results model serializers #
#####################################
class FeatureResultSerializer(serializers.ModelSerializer):
    result_date = serializers.DateTimeField(format=datetimeTZFormat)
    class Meta:
        model = Feature_result
        exclude = ('log',)
    def create(self, validated_data):
        if not isinstance(validated_data['browser'], dict):
            validated_data['browser'] = json.loads(validated_data['browser'])
        # update feature run object
        feature_run = self.context['request'].data['feature_run']
        feature_run = Feature_Runs.objects.filter(run_id=feature_run)[0]
        feature_result = Feature_result.objects.create(**validated_data)
        feature_run.feature_results.add(feature_result)
        return feature_result

class FeatureResultInfoSerializer(serializers.ModelSerializer):
    result_date = serializers.DateTimeField(format=datetimeTZFormat)
    class Meta:
        model = Feature_result
        fields = [
            'result_date',
            'status',
            'total',
            'execution_time',
            'app_name',
            'environment_name',
            'feature_result_id'
        ]
        read_only_fields = fields

class RegularFeatureResultInfoSerializer(serializers.Serializer):
    result_date = serializers.DateTimeField(format=datetimeTZFormat)
    status = serializers.CharField(max_length=100)
    total = serializers.IntegerField(default=0)
    execution_time = serializers.IntegerField()
    app_name = serializers.CharField(max_length=100)
    environment_name = serializers.CharField(max_length=10)
    feature_result_id = serializers.IntegerField()

##################################
# Feature Runs model serializers #
##################################
class FeatureRunsSerializer(serializers.ModelSerializer):

    # feature_results = serializers.SerializerMethodField()
    feature_results = FeatureResultSerializer(many=True, read_only=True)
    run_id = serializers.IntegerField(read_only=True)
    is_removed = serializers.BooleanField(read_only=True)
    archived = serializers.BooleanField(read_only=True)
    status = serializers.CharField(read_only=True)
    total = serializers.IntegerField(read_only=True)
    fails = serializers.IntegerField(read_only=True)
    ok = serializers.IntegerField(read_only=True)
    skipped = serializers.IntegerField(read_only=True)
    execution_time = serializers.IntegerField(read_only=True)
    pixel_diff = serializers.IntegerField(read_only=True)
    feature = serializers.CharField(source='feature.feature_id', read_only=True)
    date_time = serializers.DateTimeField(format=datetimeTZFormat, read_only=True)

    class Meta:
        model = Feature_Runs
        fields = (
            "run_id",
            "is_removed",
            "archived",
            "status",
            "total",
            "fails",
            "ok",
            "skipped",
            "execution_time",
            "pixel_diff",
            "feature",
            "date_time",
            "feature_results"
        )
        # extra_fields = ['feature_results']
        # exclude = ["feature_results"]
    def create(self, validated_data):
        # create feature run object
        fr = Feature_Runs.objects.create(**validated_data)
        # get the created objects run id
        run_id = fr.run_id

        # get the feature from the feature_run
        feature = fr.feature
        # update the feature info to the feature run object
        feature.info = fr
        # save the feature object
        feature.save(dontSaveSteps=True)
        # return feature run that was created at the start
        return fr
    
    @staticmethod
    def setup_eager_loading(queryset):
        #select_related for 'to-one' relationships
        queryset = queryset.select_related('feature')

        #prefetch_related for 'to-many' relationships
        queryset = queryset.prefetch_related('feature_results')

        return queryset

def sumField(querySet, field_name):
    return functools.reduce(lambda total, fr: total + getattr(fr, field_name), querySet, 0)

def getFieldsWithSpecificValue(querySet, field_name, value):
    return functools.reduce(lambda total, fr: total + 1 if getattr(fr, field_name) == value else 0, querySet, 0)

class FeatureRunInfoSerializer(serializers.ModelSerializer):
    execution_time = serializers.SerializerMethodField() # get total execution time from all the results
    total = serializers.SerializerMethodField() # get total steps from all the results
    success = serializers.SerializerMethodField() # get success based on all the feature_results
    result_date = serializers.DateTimeField(format=datetimeTZFormat, source='date_time')
    status = serializers.SerializerMethodField()
    ok = serializers.SerializerMethodField()

    class Meta:
        model = Feature_Runs
        fields = ('execution_time','status', 'total', 'success', 'result_date', 'ok')

    def get_execution_time(self, instance):
        return sumField(instance.feature_results.all(), 'execution_time')
    def get_total(self, instance):
        return sumField(instance.feature_results.all(), 'total')
    def get_ok(self, instance):
        return sumField(instance.feature_results.all(), 'ok')
    def get_status(self, instance):
        return 'Failed' if getFieldsWithSpecificValue(instance.feature_results.all(), 'success', False) > 0 else 'Success'
    def get_success(self, instance):
        return False if getFieldsWithSpecificValue(instance.feature_results.all(), 'success', False) > 0 else True


#############################
# Feature model serializers #
#############################
class FeatureSerializer(serializers.ModelSerializer, FeatureMixin):

    # get info about the latest feature result
    info = FeatureRunInfoSerializer(many=False)
    last_edited = BasicOIDCAccountSerializer(many=False)
    created_by = BasicOIDCAccountSerializer(many=False)
    last_edited_date = serializers.DateTimeField(format=datetimeTZFormat)

    class Meta:
        model = Feature
        fields = '__all__'
    def create(self, validated_data):
        return Feature.objects.create(**validated_data)

class BasicFeatureInfoSerializer(serializers.ModelSerializer, FeatureMixin):
    class Meta:
        model = Feature
        fields = ('feature_id', 'feature_name',)

class FeatureTreeSerializer(serializers.ModelSerializer, FeatureMixin):
    class Meta:
        model = Feature
        fields = ('feature_id', 'feature_name',)
    
    def to_representation(self, feature):
        treeRep = {
            "type": "feature",
            "name": feature.feature_name,
            "id": feature.feature_id
        }
        return treeRep

class FeatureHasSubFeatureSerializer(serializers.ModelSerializer, FeatureMixin):
    class Meta:
        model = Feature
        fields = ('feature_id', 'feature_name',)
    
    def to_representation(self, feature):
        get_steps = Step.objects.filter(feature_id=feature.feature_id).exclude(belongs_to=feature.feature_id).order_by('belongs_to').distinct('belongs_to')

        # get all childs
        childrens = [
            # "steps": ....
        ]
        for step in get_steps:
            stepFeature = step.belongs_to
            try:
                childrens.append(FeatureHasSubFeatureSerializer(Feature.objects.get(feature_id=stepFeature), many=False).data)
            except:
                pass

        treeRep = {
            "type": "feature",
            "name": feature.feature_name,
            "id": feature.feature_id,
            "children": childrens
        }

        return treeRep



##########################
# Step model serializers #
##########################
class StepSerializer(serializers.ModelSerializer):
    class Meta:
        model = Step
        fields = '__all__'

    def create(self, validated_data):
        return Step.objects.create(**validated_data)

##################################
# Account Role model serializers #
##################################
class AccountRoleSerializer(serializers.ModelSerializer):
    class Meta:
        model = Account_role
        fields = '__all__'
#################################
# Step Result model serializers #
#################################
class StepResultSerializer(serializers.ModelSerializer):

    belongs_to = serializers.SerializerMethodField()

    class Meta:
        model = Step_result
        fields = '__all__'

    def get_belongs_to(self, instance):
        feature = None
        try:
            feature = BasicFeatureInfoSerializer(Feature.objects.get(feature_id=instance.belongs_to), many=False).data
        except Exception as e:
            print(str(e))
            feature = {
                "feature_id": 0,
                "feature_name": "Unknown"
            }
        return feature

class StepResultRegularSerializer(serializers.Serializer):
    step_result_id = serializers.IntegerField()
    feature_result_id = serializers.IntegerField()
    step_name = serializers.CharField()
    execution_time = serializers.IntegerField()
    status = serializers.CharField(max_length=100)
    pixel_diff = serializers.IntegerField()
    template_name = serializers.CharField() # Remove when possible
    success = serializers.BooleanField()
    screenshots = serializers.JSONField(default=dict)
    previous = serializers.IntegerField(default=None)
    next = serializers.IntegerField(default=None)
    files = serializers.JSONField(default=[])
    diff = serializers.BooleanField(default=False)
    screenshot_current = serializers.CharField()
    screenshot_style = serializers.CharField()
    screenshot_difference = serializers.CharField()
    screenshot_template = serializers.CharField()


#################################
# Environment model serializers #
#################################
class EnvironmentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Environment
        fields = '__all__'

    def create(self, validated_data):
        # create a new environment using the validated_data
        new_environment = Environment.objects.create(**validated_data)
        # send a websocket to front about the creation
        response = requests.post('http://cometa_socket:3001/sendAction', json={
            'type': '[Environments] Add Environment',
            'env': IEnvironment(new_environment, many=False).data
        })

        return new_environment

#############################
# Browser model serializers #
#############################
class BrowserSerializer(serializers.ModelSerializer):
    class Meta:
        model = Browser
        fields = '__all__'

    def create(self, validated_data):
        # create a new browser using the validated_data
        return Browser.objects.create(**validated_data)

#################################
# Application model serializers #
#################################
class ApplicationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Application
        fields = '__all__'

    def create(self, validated_data):
        # create a new application using the validated_data
        new_app = Application.objects.create(**validated_data)
        # send a websocket to front about the creation
        response = requests.post('http://cometa_socket:3001/sendAction', json={
            'type': '[Applications] Add Application',
            'app': IApplication(new_app, many=False).data
        })

        return new_app

################################
# File model serializers #
################################
class FileSerializer(serializers.ModelSerializer):
    uploaded_by = BasicOIDCAccountSerializer(many=False)
    class Meta:
        model = File
        exclude = ('path',)

    def create(self, validated_data):
        return File.objects.create(**validated_data)

################################
# Department model serializers #
################################
class DepartmentSerializer(serializers.ModelSerializer):
    files = FileSerializer(many=True)

    class Meta:
        model = Department
        fields = '__all__'

    def create(self, validated_data):
        return Department.objects.create(**validated_data)
    
class DepartmentWithUsersSerializer(serializers.ModelSerializer):
    users = serializers.SerializerMethodField()
    files = FileSerializer(many=True)

    class Meta:
        model = Department
        fields = '__all__'
        extra_fields = ['users', 'files']

    def get_users(self, instance):
        accounts = OIDCAccount.objects.filter(user_id__in=instance.account_role_set.all().values_list('user', flat=True))
        return OIDCAccountSerializer(accounts, many=True).data

############################
# Action model serializers #
############################
class ActionSerializer(serializers.ModelSerializer):
    date_created = serializers.DateTimeField(format=datetimeTZFormat)
    class Meta:
        model = Action
        fields = '__all__'

    def create(self, validated_data):
        return Action.objects.create(**validated_data)

############################
# Folder model serializers #
############################
class FolderSerializer(serializers.ModelSerializer, FolderMixin):
    folders = serializers.SerializerMethodField()
    features = serializers.SerializerMethodField()

    class Meta:
        model = Folder
        fields = '__all__'

    def get_folders(self, obj):
        results = Folder.objects.filter(parent_id=obj.folder_id).order_by('-name')
        ret = FolderSerializer(results, context=self.context, many=True).data
        return ret

    def get_features(self, obj):
        # get the features list from the context
        features = self.context.get("features_list", [])
        # get all the features inside the folder
        results = Folder_Feature.objects.filter(folder_id=obj.folder_id)
        ids = [x.feature.feature_id for x in results if x.feature.feature_id in features]
        return ids

####################################
# Folder feature model serializers #
####################################
class Folder_FeatureSerializer(serializers.ModelSerializer, FolderFeatureMixin):

    class Meta:
        model = Folder_Feature
        fields = '__all__'

    def create(self, validated_data):
        return Folder_Feature.objects.create(**validated_data)

###########################################
# Environment Variables model serializers #
###########################################
class VariablesSerializer(serializers.ModelSerializer, VariablesMixin):

    # retrieve OIDC account data as read_only
    created_by_name = serializers.CharField( source='created_by.name', read_only=True)
    updated_by_name = serializers.CharField( source='updated_by.name', read_only=True)
    # department name
    department_name = serializers.CharField( source='department.department_name', read_only=True)

    class Meta:
        model = Variable
        fields = '__all__'

class VariablesTreeSerializer(serializers.ModelSerializer, VariablesMixin):
    class Meta:
        model = Variable
        fields = ['variable_name', 'variable_value']

    def to_representation(self, value):
        treeRep = {
            "type": "variable",
            "name": value.variable_name,
            "value": value.variable_value,
            "children": FeatureTreeSerializer(value.in_use, many=True).data
        }
        return treeRep
        

###########################################
# Invites model serializers #
###########################################
class InviteSerializer(serializers.ModelSerializer):

    class Meta:
        model = Invite
        depth = 2
        fields = '__all__'

    def create(self, validated_data):
        return Invite.objects.create(**validated_data)

###########################################
# Invites model serializers #
###########################################
class IntegrationSerializer(serializers.ModelSerializer):

    department = DepartmentSerializer(many=False)

    class Meta:
        model = Integration
        depth = 2
        fields = '__all__'

    def create(self, validated_data):
        return Integration.objects.create(**validated_data)

#######################################
# Authentication Provider serializers #
#######################################
class AuthenticationProviderSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    name = serializers.CharField(max_length=255)
    issuer = serializers.CharField(max_length=255)
    icon = serializers.CharField(max_length=255)
    background_color = serializers.CharField(max_length=255)
    active = serializers.BooleanField(default=False)
    useCaptcha = serializers.BooleanField(default=True)

##############################
# Schedule model serializers #
##############################
class ScheduleSerializer(serializers.ModelSerializer):
    created_on = serializers.DateTimeField(format=datetimeTZFormat)
    delete_on = serializers.DateTimeField(format=datetimeTZFormat)
    class Meta:
        model = Schedule
        fields = '__all__'

#######################
# FRONTEND INTERFACES #
#######################
class IAccount(serializers.Serializer): # OIDCAccount Interface
    user_id = serializers.IntegerField()
    email = serializers.EmailField(max_length=100)
    name = serializers.CharField(max_length=250)
    permission_name = serializers.SerializerMethodField()
    user_permissions = PermissionsSerializer(many=False)
    departments = serializers.SerializerMethodField()
    created_on = serializers.DateTimeField()
    last_login = serializers.DateTimeField()

    def get_permission_name(self, instance):
        return instance.user_permissions.permission_name

    def get_departments(self, instance):
        return [x[0] for x in Account_role.objects.filter(user=instance).values_list('department')]

class IApplication(serializers.Serializer): # Application Interface
    app_id = serializers.IntegerField()
    app_name = serializers.CharField(max_length=250)

class IDepartment(serializers.Serializer): # Department Interface
    department_id = serializers.IntegerField()
    department_name = serializers.CharField(max_length=250)
    settings = serializers.JSONField()
    slug = serializers.SlugField(max_length=255)

class IEnvironment(serializers.Serializer): # Environment Interface
    environment_id = serializers.IntegerField()
    environment_name = serializers.CharField(max_length=250)