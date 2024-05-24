from django.db import models
from slugify import slugify
import datetime
from django.contrib.postgres.fields import ArrayField
from django.forms.models import model_to_dict
from pathlib import Path
import json, os, re, requests, time
from pprint import pprint
import glob
from django.conf import settings
from django.db.models.query import ModelIterable, QuerySet
import warnings
from backend.utility.functions import getBrowserKey, getStepResultScreenshotsPath, get_model, getLogger
import shutil
from backend.common import *
from django.db.models.signals import post_delete, pre_delete
from django.dispatch import receiver
from django_cryptography.fields import encrypt
from crontab import CronSlices

# GLOBAL VARIABLES

# check if we are inside a loop
insideLoop = False
# get logger
logger = getLogger()

# Step Keywords
step_keywords = (
    ('Given', 'Given',),
    ('When', 'When',),
    ('Then', 'Then',),
    ('and', 'and',),
)

# File Status
file_status = (
    ('Unknown', 'Unknown',),
    ('Processing', 'Processing',),
    ('Scanning', 'Scanning',),
    ('DataDriven', 'Data Driven Check',),
    ('Encrypting', 'Encrypting',),
    ('Done', 'Done',),
    ('Error', 'Error',),
)

# Variable Base
variable_base = (
    ('department', 'Department',),
    ('environment', 'Environment',),
    ('feature', 'Feature',),
)

# utility functions


def get_feature_path(feature):
    """
    Returns the store path for the given feature meta and steps files
    """
    feature = get_model(feature, Feature)
    path = '/code/behave/department_data/'+slugify(feature.department_name)+'/'+slugify(feature.app_name)+'/'+feature.environment_name+'/'
    # Make sure path exists
    Path(path).mkdir(parents=True, exist_ok=True)

    # Make sure subfolders exist
    os.makedirs(path + 'features',exist_ok=True)
    os.makedirs(path + 'screenshots',exist_ok=True)
    os.makedirs(path + 'steps',exist_ok=True)
    os.makedirs(path + 'junit_reports',exist_ok=True)
    os.makedirs(path + 'metrics',exist_ok=True)

    # Create the filename
    featureFileName = str(feature.feature_id)+'_'+feature.slug
    
    # Create full path
    fullpath = path + "features/" + featureFileName

    return {
        "path": path,
        "featureFileName": featureFileName,
        "fullPath": fullpath
    }

def backup_feature_steps(feature):
    """
    Automatically creates a backup of the given feature steps
    """
    # Create backup file
    feature = get_model(feature, Feature)
    # Retrieve feature path
    feature_dir = get_feature_path(feature.feature_id)
    file = feature_dir['featureFileName']
    path = feature_dir['path'] + 'features/'
    time = datetime.datetime.now().strftime("%Y-%m-%d_%H-%M-%S")
    # Make sure backups folder exists
    backupsFolder = '/code/backups/features/'
    Path(backupsFolder).mkdir(parents=True, exist_ok=True)
    orig_file = path + file + '.json'
    dest_file = backupsFolder + file + '_' + time + '_steps.json'
    if os.path.exists(orig_file):
        shutil.copyfile(orig_file, dest_file)
        logger.debug('Created feature backup in %s' % dest_file)
    else:
        logger.debug('Feature file %s not found.' % orig_file)

def backup_feature_info(feature):
    """
    Automatically creates a backup of the given feature
    """
    # Create backup file
    feature = get_model(feature, Feature)
    # Retrieve feature path
    feature_dir = get_feature_path(feature.feature_id)
    file = feature_dir['featureFileName']
    path = feature_dir['path'] + 'features/'
    time = datetime.datetime.now().strftime("%Y-%m-%d_%H-%M-%S")
    # Make sure backups folder exists
    backupsFolder = '/code/backups/features/'
    Path(backupsFolder).mkdir(parents=True, exist_ok=True)
    orig_file = path + file + '_meta.json'
    dest_file = backupsFolder + file + '_' + time + '_meta.json'
    # creating backup of meta file of feature
    if os.path.exists(orig_file):
        shutil.copyfile(orig_file, dest_file)
        logger.debug('Created meta file feature backup in %s' % dest_file)
    else:
        logger.debug('Feature meta file %s not found.' % orig_file)
    # backup the JSON file with the step content
    orig_file = path + file + '.json'
    dest_file = backupsFolder + file + '_' + time + '.json'
    if os.path.exists(orig_file):
        shutil.copyfile(orig_file, dest_file)
        logger.debug('Created json feature backup containing steps in %s' % dest_file)
    else:
        logger.debug('Feature json file %s not found.' % orig_file)

def recursiveSubSteps(steps, feature_trace, analyzed_features, parent_department_id=None, recursive_step_level=0):
    # logger.debug(f"Analyzed feature length  {len(analyzed_features)} feature Trace > {feature_trace}")
    updatedSteps = steps.copy()
    index = 0
    for step in steps:
        updateIndex = 1
        subFeatureExecution = re.search(r'^.*Run feature with (?:name|id) "(.*)"', step['step_content'])
        if subFeatureExecution:
            featureNameOrId = subFeatureExecution.group(1)
            # get subfeature
            # logger.debug(f"LEVEL {recursive_step_level} Processing Feature {featureNameOrId} recursively")
            is_feature_analyzed = False
            subFeature = None
            subFeatureSteps = None
            # logger.debug("Checking analyzed_features")
            for feature_and_steps in analyzed_features:
                feature = feature_and_steps.get("feature")
                # logger.debug(f"Checking {featureNameOrId}, Current feature is {feature.feature_id} name {feature.feature_name}")
                if str(feature.feature_id)==featureNameOrId or feature.feature_name==featureNameOrId:
                    # logger.debug("Feature found in the 'analyzed_features', Will skip the DB ")
                    is_feature_analyzed = True
                    subFeature = feature
                    subFeatureSteps = feature_and_steps.get("steps")
                    break
            # When feature is not found in analyzed_features
            if not is_feature_analyzed:
                # logger.debug("Feature is not analyzed. Searching feature in the DB")
                try:
                    if featureNameOrId.isnumeric():
                        subFeature = Feature.objects.get(feature_id=featureNameOrId, department_id=parent_department_id) 
                    else:
                        subFeature = Feature.objects.get(feature_name=featureNameOrId, department_id=parent_department_id)
                except Feature.DoesNotExist as exception:
                    raise Exception('Unable to find feature with specified name or id: %s' % str(featureNameOrId))

            if is_feature_analyzed or subFeature:
                # If feature not found in the "analyzed_features" and then take it from DB feature
                # if not is_feature_analyzed:
                #     subFeature = subFeature[0]
                # check if we would get caught in infinite loop
                if subFeature.feature_id not in feature_trace:
                    # add the current feature id to the trace
                    feature_trace.append(subFeature.feature_id)
                    # get all the steps from the feature, only those enabled steps

                    if not is_feature_analyzed:
                        # logger.debug("Feature steps are not analyzed. Searching related step in the DB")
                        # Get all the steps from the feature, only those enabled steps
                        subFeatureSteps = Step.objects.filter(feature_id=subFeature.feature_id).filter(models.Q(step_type='normal') | models.Q(step_type="subfeature")).filter(enabled=True)
                        # loop over all substeps and set the belongs_to if not set 
                        # do only if feature step was not found in the analyzed_features, If found it means it was done earlier 
                        # logger.debug("Updating step belongs_to")
                        for subStep in subFeatureSteps:
                            if subStep.belongs_to == None or not subStep.belongs_to:
                                subStep.belongs_to = subFeature.feature_id
                                logger.debug(f"LEVEL {recursive_step_level} Saving the step to update the belongs_to in recursiveSubSteps")
                                subStep.save()
                        analyzed_features.append({'feature': subFeature, 'steps': subFeatureSteps })

                    # get values from substeps and convert it to list
                    subFeatureSteps = list(subFeatureSteps.values())
                    # check and modify continue_on_failure on sub steps if is set in the "Run feature" parent step or in the feature
                    # logger.debug("Analyzing continue on failure")
                    if step['continue_on_failure'] or subFeature.continue_on_failure:
                        logger.debug("Setting continue_on_failure to True")
                        for idx, val in enumerate(subFeatureSteps):
                            subFeatureSteps[idx]['continue_on_failure'] = True
                    # check if substeps contain other subfeatures
                    # logger.debug(f"LEVEL {recursive_step_level} Processing recursive steps for feature -> {featureNameOrId}")
                    # Add current feature and step analyzed_features to reduce the query for same feature in recursion                        
                    # logger.debug(f"Sending to recursion analyzed feature length  {len(analyzed_features)} ")
                    subSteps, analyzed_features = recursiveSubSteps(subFeatureSteps, feature_trace, analyzed_features, subFeature.department_id, recursive_step_level+1)
                    # check if subSteps returned False
                    if isinstance(subSteps, bool) and not subSteps:
                        return False
                    # else delete the current index
                    del updatedSteps[index]
                    # add substeps at position of the current index
                    updatedSteps[index:0] = subSteps
                    # set the number by what amount the index should get updated by
                    updateIndex = len(subSteps)
                    # remove current feature id trace from the general trace
                    del feature_trace[-1]
                else:
                    # add the current feature id to the trace
                    feature_trace.append(subFeature.feature_id)
                    # raise an exception with error
                    raise Exception('Infinite loop found. Trace: %s' % " ➔ ".join([str(x) for x in feature_trace]))
            else:
                # raise an exception with error
                raise Exception('Unable to find feature with specified name or id: %s' % str(featureNameOrId))
                # del updatedSteps[index]
        # updated the index
        index += updateIndex
        # logger.debug(f"Return analyzed feature length  {len(analyzed_features)} ")
    return updatedSteps, analyzed_features

# adds step to the featureFile
def add_step_to_feature_file(step, featureFile):
    global insideLoop
    
    startingIndent = "\n\t\t"
    if insideLoop and not re.search(r'^.*Loop "(.*)" times starting at "(.*)" and do', step['step_content']):
        startingIndent = "\n\t\t\t"

    if not insideLoop and re.search(r'^.*End Loop', step['step_content']):
        featureFile.write('\n\t\t\t"""')

    # before saving to the file check if step is javascript function if so save the content as step description
    if "Javascript" in step['step_content']:
        write_multiline_javascript_step(featureFile, step)
    elif "Send keys" in step['step_content']:
        write_multiline_send_keys_step(featureFile, step)
    else:
        featureFile.write('%s%s %s' % (startingIndent, step['step_keyword'], step['step_content'].replace('\\xa0', ' ').replace('\n', '')))
    
    if insideLoop and re.search(r'^.*Loop "(.*)" times starting at "(.*)" and do', step['step_content']):
        featureFile.write('\n\t\t\t"""')

def checkLoop(step):
    global insideLoop

    # check if step is a loop if so set loop value to true
    loop = re.search(r'^.*Loop "(.*)" times starting at "(.*)" and do', step['step_content'])
    if loop and insideLoop:
        # throw error and 
        insideLoop = False #When it throws error insideLoop = False, insideLoop is global variable effect other feature save  
        return {"success": False, "error": "Multi level loop are not allowed."}
    if loop:
        insideLoop = True
    # check if step is end loop
    endLoop = re.search(r'^.*End Loop', step['step_content'])
    if endLoop:
        insideLoop = False

    return {"success": True, "insideLoop": insideLoop}


# create_feature_file
# Creates the .feature file
# @param featureFileName: string - Contains file of the feature
# @param steps: Array - Array of the steps definition
# @param feature_id: Feature - Info of the feature
def create_feature_file(feature, steps, featureFileName):
    logger.debug(f"Creating feature file {featureFileName}")
    with open(featureFileName+'.feature', 'w+') as featureFile:
        featureFile.write('Feature: '+feature.feature_name+'\n\n')
        logger.debug("Feature name added to file")
        # save the steps to save to database before removing old steps
        stepsToAdd = []

        featureFile.write('\tScenario: First')
        logger.debug(f"Checking steps : Steps Length {len(steps)}")
        count = 1
        analyzed_features = []
        for step in steps:
            # Comment this debugging
            # logger.debug(f"{count} Checking Step {step}")
            count+=1
            # check if for some reason substeps are sent us from front and ignore them
            if "step_type" in step and step['step_type'] == "substep":
                continue
            # remove the step type before adding it to the stepsToAdd to avoid old feature to show wrong steps
            step['step_type'] = None
            # add current step to the list to be added to the database
            stepsToAdd.append(step)
            # check if step is set to enabled
            if step['enabled'] == True:
                # remove belongs to from step
                step.pop('belongs_to', None)
                # check if current feature is a sub feature execution
                subFeature = re.search(r'^.*Run feature with (?:name|id) "(.*)"', step['step_content'])
                # check if its a loop related step
                result = checkLoop(step)
                if not result['success']:
                    return result
                if subFeature:
                    try:
                        recursive_step_level = 0
                        logger.debug(f"Sending feature length  {len(analyzed_features)} ")
                        # get recursive steps from the sub feature
                        subSteps, analyzed_features = recursiveSubSteps([step], [feature.feature_id], analyzed_features, feature.department_id, recursive_step_level)
                        logger.debug(f"Analyzed feature length  {len(analyzed_features)} ")
                    except Exception as error:
                        return {"success": False, "error": str(error)}
                    # otherwise loop over substeps
                    for subStep in subSteps:
                        # check if substep is enabled
                        if subStep['enabled']:
                            # check if its a loop related step
                            subResult = checkLoop(subStep)
                            if not subResult['success']:
                                return subResult
                            subStep['step_type'] = "substep"
                            # add the substep found in substep
                            stepsToAdd.append(subStep)
                            # save to the file
                            add_step_to_feature_file(subStep, featureFile)
                else:
                    # if enabled and not a sub feature execution add to the file
                    add_step_to_feature_file(step, featureFile)
        featureFile.write('\n')
        
        logger.debug("Step checks completed")
    
    from django.db import IntegrityError, transaction
    try:
        with transaction.atomic():
            # delete all the steps from the database 
            Step.objects.filter(feature_id=feature.feature_id).delete()
            # gather all the variables found during the save steps
            variables_used = []

            # save all the steps found in stepsToAdd to the database
            logger.debug(f"Preparing steps to add | Steps Length {len(stepsToAdd)}")
            count = 1
            for step in stepsToAdd:
                # Comment this debugging
                # logger.debug(f"{count} Processing Step {step}")
                count+=1
                if step.get("step_type", None) == None:
                    step['step_type'] = "subfeature" if re.search(r'^.*Run feature with (?:name|id) "(.*)"', step['step_content']) else "normal"
                    # check if step contains a variable
                    regexPattern = r'\$(?P<var_name_one>.+?\b)|variable "(?P<var_name_two>.+?\b)|save .+?to "(?P<var_name_three>.+?\b)'
                    matches = re.findall(regexPattern, step['step_content'].replace('\\xa0', ' '))
                    if matches: 
                        for match in matches:
                            # get the variable var_name
                            variable_name = match[0] or match[1] or match[2]
                            if variable_name:
                                variables_used.append(variable_name)

                # change sleep step timeout
                sleep_match = re.findall(r'I (?:can )?sleep "(.*?)".*', step['step_content'].replace('\\xa0', ' '))
                if sleep_match:
                    try:
                        step['timeout'] = int(sleep_match[0]) + 5
                    except ValueError:
                        # default timeout will be set later on
                        pass
                Step.objects.create(
                    feature_id = feature.feature_id,
                    step_keyword = step['step_keyword'],
                    step_content = step['step_content'].replace('\\xa0', ' '),
                    enabled = step['enabled'],
                    step_type = step['step_type'],
                    screenshot = step['screenshot'],
                    compare = step['compare'],
                    continue_on_failure = step.get('continue_on_failure', False) or False, # just incase front sends continue_on_failure = null
                    belongs_to = step.get('belongs_to', feature.feature_id),
                    timeout = step.get('timeout', 60)
                )

    except IntegrityError as e:
        logger.debug(f"Exception while saving steps with transactions | Feature ID : {feature.feature_id}")
        logger.exception(e)

    logger.debug("Finding Variables")
    # update all the variables
    # get all the variable with this name and from same department as the current feature
    vars = Variable.objects.filter(department_id=feature.department_id, variable_name__in=variables_used)
    # reset variables used in the feature
    logger.debug("Setting used variable in feature")
    feature.variable_in_use.set(vars)
    # return success true
    return {"success": True}

def write_multiline_javascript_step(featureFile, step):
    global insideLoop

    startingIndent = "\t\t"
    quotes = '"""'
    if insideLoop:
        startingIndent = "\t\t\t"
        quotes = "'''"
    # pattern to get all js code inside ""
    js_function_pattern = re.search(r'Run Javascript function "(.*)"', step['step_content'], re.MULTILINE|re.DOTALL)
    # get the code from the pattern
    js_function = js_function_pattern.group(1)
    featureFile.write('\n%s%s %s\n' % (startingIndent, step['step_keyword'], u'Run Javascript function "// function is set in step description!!"'.replace('\\xa0', ' ')))
    featureFile.write('%s\t%s\n%s\t%s\n%s\t%s' % (startingIndent, quotes, startingIndent, js_function.replace("\n", f"\n{startingIndent}\t"), startingIndent, quotes))

def write_multiline_send_keys_step(featureFile, step):
    global insideLoop

    startingIndent = "\t\t"
    quotes = '"""'
    if insideLoop:
        startingIndent = "\t\t\t"
        quotes = "'''"
    # pattern to get all js code inside ""
    js_function_pattern = re.search(r'Send keys "(.*)"', step['step_content'], re.MULTILINE|re.DOTALL)
    # get the code from the pattern
    js_function = js_function_pattern.group(1)
    featureFile.write('\n%s%s %s\n' % (startingIndent, step['step_keyword'], u'Send keys "// text is set in step description!!"'.replace('\\xa0', ' ')))
    featureFile.write('%s\t%s\n%s\t%s\n%s\t%s' % (startingIndent, quotes, startingIndent, js_function.replace("\n", "\n\t\t\t"), startingIndent, quotes))

# create_json_file
# Creates the .json file
# @param featureFileName: string - Contains file of the feature
# @param steps: Array - Array of the steps definition
def create_json_file(feature, steps, featureFileName):
    with open(featureFileName+'.json', 'w') as file:
        json.dump(steps, file)

# create_meta_file
# Creates the _meta.json file
# @param featureFileName: string - Contains file of the feature
# @param feature: Feature - Information of the feature
def create_meta_file(feature, featureFileName):
    with open(featureFileName+'_meta.json', 'w') as file:
        json.dump(model_to_dict(feature), file, default=str)

class SoftDeletableQuerySetMixin:
    """
    QuerySet for SoftDeletableModel. Instead of removing instance sets
    its ``is_removed`` field to True.
    """

    def delete(self):
        """
        Soft delete objects from queryset (set their ``is_removed``
        field to True)
        """
        self.update(is_removed=True)

class SoftDeletableQuerySet(SoftDeletableQuerySetMixin, QuerySet):
    pass

class SoftDeletableManagerMixin:
    """
    Manager that limits the queryset by default to show only not removed
    instances of model.
    """
    _queryset_class = SoftDeletableQuerySet

    def __init__(self, *args, _emit_deprecation_warnings=False, **kwargs):
        self.emit_deprecation_warnings = _emit_deprecation_warnings
        super().__init__(*args, **kwargs)

    def get_queryset(self):
        """
        Return queryset limited to not removed entries.
        """

        if self.emit_deprecation_warnings:
            warning_message = (
                "{0}.objects model manager will include soft-deleted objects in an "
                "upcoming release; please use {0}.available_objects to continue "
                "excluding soft-deleted objects. See "
                "https://django-model-utils.readthedocs.io/en/stable/models.html"
                "#softdeletablemodel for more information."
            ).format(self.model.__class__.__name__)
            warnings.warn(warning_message, DeprecationWarning)

        kwargs = {'model': self.model, 'using': self._db}
        if hasattr(self, '_hints'):
            kwargs['hints'] = self._hints

        return self._queryset_class(**kwargs).filter(is_removed=False)

class SoftDeletableManager(SoftDeletableManagerMixin, models.Manager):
    pass

# This class prevents any model where it is implemented to not be completely deleted, just marks the model as deleted
# This class can be implemented in any model as `class x(SoftDeletableModel)``
# Usage:
#  - Model.objects.all()            # returns all, including deleted
#  - Model.available_objects.all()  # returns items not deleted
#  - Model.all_objects.all()        # same as objects.all()
#
# To implement another delete() function in Model please use `do_delete(self)`
class SoftDeletableModel(models.Model):
    """
    An abstract base class model with a ``is_removed`` field that
    marks entries that are not going to be used anymore, but are
    kept in db for any reason.
    Default manager returns only not-removed entries.
    """
    is_removed = models.BooleanField(default=False)

    class Meta:
        abstract = True

    objects = SoftDeletableManager(_emit_deprecation_warnings=True)
    available_objects = SoftDeletableManager()
    all_objects = models.Manager()

    def restore(self, using=None):
        self.is_removed = False
        self.save(using=using)

    def delete(self, using=None, soft=True, *args, **kwargs):
        """
        Soft delete object (set its ``is_removed`` field to True).
        Actually delete object if setting ``soft`` to False.
        """
        if soft:
            self.is_removed = True
            self.save(using=using)
            """ print('Entering delete() of SoftDeletableModel')
            self.deleted = True
            self.save()
            # Allow for custom delete() function in Model
            do_delete_fn = getattr(self, 'do_delete', None)
            if callable(do_delete_fn):
                print('Entering custom do_delete() of SoftDeletableModel')
                do_delete_fn(*args, **kwargs) """
        else:
            return super().delete(using=using, *args, **kwargs)

# MODELS
class Permissions(models.Model):
    permission_id = models.AutoField(primary_key=True)
    permission_name = models.CharField(max_length=255, blank=False, null=False, unique=True)
    permission_power = models.IntegerField(default=0, help_text="Allows to specify the power level for the permission.")
    
    # OIDCAccount related
    create_account = models.BooleanField(default=False)
    edit_account = models.BooleanField(default=False)
    delete_account = models.BooleanField(default=False)
    view_accounts = models.BooleanField(default=False)
    
    # Application related
    create_application = models.BooleanField(default=False)
    edit_application = models.BooleanField(default=False)
    delete_application = models.BooleanField(default=False)
    
    # Environment related
    create_environment = models.BooleanField(default=False)
    edit_environment = models.BooleanField(default=False)
    delete_environment = models.BooleanField(default=False)
    
    # Department related
    create_department = models.BooleanField(default=False)
    edit_department = models.BooleanField(default=False)
    delete_department = models.BooleanField(default=False)
    
    # Browser related
    create_browser = models.BooleanField(default=False)
    edit_browser = models.BooleanField(default=False)
    delete_browser = models.BooleanField(default=False)
    
    # Feature related
    ## Department related
    create_feature = models.BooleanField(default=False)
    edit_feature = models.BooleanField(default=False)
    delete_feature = models.BooleanField(default=False)
    run_feature = models.BooleanField(default=False)
    view_feature = models.BooleanField(default=False)
    
    # Step_result related
    remove_screenshot = models.BooleanField(default=False)
    
    # Feature_result related
    remove_feature_result = models.BooleanField(default=False)
    download_result_files = models.BooleanField(default=False)
    
    # Feature_runs related
    remove_feature_runs = models.BooleanField(default=False)
    
    # FrontEnd related
    view_admin_panel = models.BooleanField(default=False, editable=False)
    view_departments_panel = models.BooleanField(default=False)
    view_applications_panel = models.BooleanField(default=False)
    view_browsers_panel = models.BooleanField(default=False)
    view_environments_panel = models.BooleanField(default=False)
    view_features_panel = models.BooleanField(default=False)
    view_accounts_panel = models.BooleanField(default=False)
    view_others_panel = models.BooleanField(default=False)

    # FrontEnd department admin panel related
    show_all_departments = models.BooleanField(default=False)
    show_department_users = models.BooleanField(default=False)

    # Folder related
    create_folder = models.BooleanField(default=False)
    delete_folder = models.BooleanField(default=False)
    
    # environment variables
    create_variable = models.BooleanField(default=False)
    edit_variable = models.BooleanField(default=False)
    delete_variable = models.BooleanField(default=False)
    
    def __str__( self ):
        return u"%s" % self.permission_name
    def __unicode__(self):
        return u'%s' % self.permission_name
    
    @classmethod
    def get_default_permission(cls):
        permission, created = cls.objects.get_or_create(
            permission_name='ANONYMOUS',
            permission_power=10,
            create_feature=True,
            edit_feature=True,
            run_feature=True,
            view_feature=True,
            create_variable=True,
            edit_variable=True
        )
        return permission.pk
    class Meta:
        ordering = ['permission_name']
        verbose_name_plural = "Permissions"

    # set the view_admin_panel to true if any of the view_panels are set to true
    def save(self, *args, **kwargs):
        self.view_admin_panel = True if self.view_departments_panel or self.view_applications_panel or self.view_browsers_panel or self.view_environments_panel or self.view_features_panel or self.view_accounts_panel else False
        super(Permissions, self).save(*args, **kwargs)

class OIDCAccount(models.Model):
    user_id = models.AutoField(primary_key=True)
    name = models.CharField(max_length=250)
    email = models.EmailField(max_length=100)
    user_permissions = models.ForeignKey(Permissions, on_delete=models.SET_NULL, null=True, default=Permissions.get_default_permission)
    created_on = models.DateTimeField(default=datetime.datetime.utcnow, editable=True, null=False, blank=False)
    last_login = models.DateTimeField(default=datetime.datetime.utcnow, editable=True, null=False, blank=False)
    login_counter = models.IntegerField(default=0, help_text="+1 on each login.")
    favourite_browsers = models.JSONField(default=list, blank=True)
    settings = models.JSONField(default=dict, blank=True)
    stripe_customer_id = models.CharField(max_length=255, blank=True)

    def __str__( self ):
        return u"%s - %s" % (self.name, self.email)
    class Meta:
        ordering = ['name']
        verbose_name_plural = "OIDCAccounts"

# Logging models to register all backend calls
# Testcases:
# Find number of logins per month, year
# Find who deleted a folder
# Find who edited a feature
# Find who scheduled a feature
# Find who changed a subscription
# Find number of invites
# Find the user that invites most people

class Application(models.Model):
    app_id = models.AutoField(primary_key=True)
    app_name = models.CharField(max_length=100, unique=True)
    slug = models.SlugField(default=None, null = True, blank=True, max_length=255)
    created_on = models.DateTimeField(default=datetime.datetime.utcnow, editable=True, null=False, blank=False)
    def __str__( self ):
        return u"Application_name = %s" % self.app_name
    def save(self, *args, **kwargs):
        self.slug = slugify(self.app_name)
        super(Application, self).save(*args, **kwargs)
    def __str__( self ):
        return f"{self.app_name} ({self.app_id})"
    class Meta:
        ordering = ['app_name']
        verbose_name_plural = "Applications"

class Environment(models.Model):
    environment_id = models.AutoField(primary_key=True)
    environment_name = models.CharField(max_length=100)
    created_on = models.DateTimeField(default=datetime.datetime.utcnow, editable=True, null=False, blank=False)
    def __str__( self ):
        return f"{self.environment_name} ({self.environment_id})"
    class Meta:
        ordering = ['environment_name']
        verbose_name_plural = "Environments"

class Browser(models.Model):
    browser_id = models.AutoField(primary_key=True)
    browser_json = models.JSONField(default=dict)
    def __str__( self ):
        if self.browser_json:
            if self.browser_json.get('mobile_emulation', False):
                st = u"%s (emulated)" % self.browser_json['device']
            else:
                st = u"%s %s" % (self.browser_json['browser'], self.browser_json['browser_version'])
                st = st.capitalize()
        else:
            st = "Unspecified"
        return st
    class Meta:
        ordering = ['browser_id']
        verbose_name_plural = "Browsers"

class Department(models.Model):
    department_id = models.AutoField(primary_key=True)
    department_name = models.CharField(max_length=100)
    slug = models.SlugField(default=None, null = True, blank=True, max_length=255)
    settings = models.JSONField(default=dict, blank=True)
    created_on = models.DateTimeField(default=datetime.datetime.utcnow, editable=True, null=False, blank=False)
    readonly_fields = ('department_id',)
    def save(self, *args, **kwargs):
        self.slug = slugify(self.department_name)
        super(Department, self).save(*args, **kwargs)

    def __str__( self ):
        return f"{self.department_name} ({self.department_id})"
    class Meta:
        ordering = ['department_name']
        verbose_name_plural = "Departments"

class Step(models.Model):
    id = models.AutoField(primary_key=True)
    feature_id = models.IntegerField(db_index=True)
    step_keyword = models.CharField(max_length=10, choices=step_keywords, default="Given")
    step_content = models.TextField()
    enabled = models.BooleanField(default=True)
    step_type = models.CharField(max_length=255, default="normal", blank=False, null=False)
    screenshot = models.BooleanField(default=False)
    compare = models.BooleanField(default=False)
    belongs_to = models.IntegerField(null=True)
    timeout = models.IntegerField(default=60)
    continue_on_failure = models.BooleanField(default=False)
    def __str__( self ):
        return u"Step_name = %s" % self.step_content
    class Meta:
        ordering = ['id']
        verbose_name_plural = "Steps"

class Feature(models.Model):
    feature_id = models.AutoField(primary_key=True)
    feature_name = models.CharField(max_length=255)
    description = models.TextField(null=True)
    app_id = models.IntegerField()
    app_name = models.CharField(max_length=255)
    environment_id = models.IntegerField()
    environment_name = models.CharField(max_length=255)
    steps = models.IntegerField()
    schedule = models.ForeignKey("Schedule", on_delete=models.SET_DEFAULT, null=True, default=None, related_name="scheduled")
    department_id = models.IntegerField()
    department_name = models.CharField(max_length=255)
    screenshot = models.TextField(null=False)
    compare = models.TextField(null=True, blank=True)
    slug = models.SlugField(default=None, null = True, blank=True, max_length=255)
    depends_on_others = models.BooleanField(default=False)
    cloud = models.TextField(max_length=100, null=False, blank=False, default="local")
    browsers = models.JSONField(default=list)
    last_edited = models.ForeignKey(OIDCAccount, on_delete=models.SET_NULL, null=True, default=None, related_name="last_edited")
    last_edited_date = models.DateTimeField(default=datetime.datetime.utcnow, editable=True, null=False, blank=False)
    created_on = models.DateTimeField(default=datetime.datetime.utcnow, editable=True, null=False, blank=False)
    created_by = models.ForeignKey(OIDCAccount, on_delete=models.SET_NULL, null=True, default=None, related_name="created_by")
    send_mail = models.BooleanField(default=False)
    send_mail_on_error = models.BooleanField(default=False)
    email_address = ArrayField(models.CharField(max_length=250), null=True, blank=True, default=list)
    email_subject = models.CharField(max_length=250, null=True, blank=True)
    email_body = models.TextField(null=True, blank=True)
    video = models.BooleanField(default=True)
    network_logging = models.BooleanField(default=False)
    generate_dataset = models.BooleanField(default=False)
    continue_on_failure = models.BooleanField(default=False)
    need_help = models.BooleanField(default=False)
    info = models.ForeignKey('Feature_Runs', on_delete=models.SET_NULL, null=True, default=None, related_name='info')
    readonly_fields=('feature_id',)
    def __str__( self ):
        return f"{self.feature_name} ({self.feature_id})"
    def save(self, *args, **kwargs):
        self.slug = slugify(self.feature_name)
        
        # create backup only if feature is being modified
        if self.feature_id is not None:
            # Backup feature info before saving
            backup_feature_info(self)

        # save to get the feature_id in case it is a new feature
        super(Feature, self).save(*args)

        # Save feature except in FeatureResultSerializer
        if not kwargs.get('dontSaveSteps', False):
            # get featureFileName
            featureFileName = get_feature_path(self)['fullPath']
            # Create / Update .feature and jsons whenever feature info is updated / created
            steps = kwargs.get('steps', list(Step.objects.filter(feature_id=self.feature_id).order_by('id').values()))
            logger.debug(f"Saving steps received from Front: {steps}")
            # Create .feature
            response = create_feature_file(self, steps, featureFileName)
            logger.debug("Feature file created")
            # check if infinite loop was found
            if not response['success']:
                logger.debug("Creation of feature was not success. Abort")
                return response # {"success": False, "error": "infinite loop found"}
            
            # Create .json
            logger.debug(f"Creating Json file : {featureFileName}")
            create_json_file(self, steps, featureFileName)
            # Create _meta.json
            logger.debug(f"Creating meta file : {featureFileName}")
            create_meta_file(self, featureFileName)
            logger.debug(f"meta file Created")
        return {"success": True}
    
    def delete(self, *args, **kwargs):
        # Remove runs and feature results
        Feature_Runs.available_objects.filter(feature__feature_id=self.feature_id).delete()
        Feature_result.available_objects.filter(feature_id=self.feature_id).delete()
        feature_screenshots = '/code/behave/screenshots/%s/' % str(self.feature_id)
        feature_templates = '/code/behave/screenshots/templates/%s/' % str(self.feature_id)

        # Delete folder with step results, runs and feature results
        if os.path.exists(feature_screenshots):
            try:
                shutil.rmtree(feature_screenshots)
            except Exception as err:
                print(str(err))
        
        # Delete folder with templates
        if os.path.exists(feature_templates):
            try:
                shutil.rmtree(feature_templates)
            except Exception as err:
                print(str(err))
        
        # Perform delete and return true
        super(Feature, self).delete()

        return True
    class Meta:
        ordering = ['last_edited_date']
        verbose_name_plural = "Features"
        indexes = [
            models.Index(fields=['feature_name']),   
        ]

class Feature_result(SoftDeletableModel):
    feature_result_id = models.AutoField(primary_key=True)
    feature_id = models.ForeignKey(Feature, related_name="feature_results", on_delete=models.CASCADE)
    result_date = models.DateTimeField()
    feature_name = models.CharField(max_length=100, blank=True)
    app_id = models.IntegerField(blank=True)
    app_name = models.CharField(max_length=100, blank=True)
    environment_id = models.IntegerField(blank=True)
    environment_name = models.CharField(max_length=100, blank=True)
    department_id = models.IntegerField(blank=True)
    department_name = models.CharField(max_length=100, blank=True)
    description = models.TextField(null=True, blank=True, default=None)
    browser = models.JSONField(default=dict)
    total = models.IntegerField(default=0)
    fails = models.IntegerField(default=0)
    running = models.BooleanField(default=False)
    ok = models.IntegerField(default=0)
    skipped = models.IntegerField(default=0)
    execution_time = models.IntegerField(default=0)
    pixel_diff = models.BigIntegerField(default=0)
    success = models.BooleanField(default=False)
    status = models.CharField(max_length=100, default="")
    screen_style = models.CharField(max_length=100, blank=True, default='')
    screen_actual = models.CharField(max_length=100, blank=True, default='')
    screen_diff = models.CharField(max_length=100, blank=True, default='')
    log=models.TextField(default='')
    video_url = models.TextField(blank=True, null=True)
    files = models.JSONField(default=list)
    archived = models.BooleanField(default=False)
    executed_by = models.ForeignKey(OIDCAccount, on_delete=models.SET_NULL, null=True, default=None)
    run_hash = models.CharField(max_length=100, default='')
    session_id = models.CharField(max_length=255, null=True, default=None)
    network_logging_enabled = models.BooleanField(default=False) # If set to false it will not query in NetworkResponse, will reduce query time
    class Meta:
        ordering = ['result_date']
        verbose_name_plural = "Feature Results"

    # updated columns data
    def save(self, *args, **kwargs):

        # update feature_name from the feature
        self.feature_name = self.feature_id.feature_name
        # update app_id and app_name from the feature
        self.app_id = self.feature_id.app_id
        self.app_name = self.feature_id.app_name
        # update environment_id and environment_name from the feature
        self.environment_id = self.feature_id.environment_id
        self.environment_name = self.feature_id.environment_name
        # update department_id and department_name from the feature
        self.department_id = self.feature_id.department_id
        self.department_name = self.feature_id.department_name

        # save the feature_result
        super(Feature_result, self).save(*args)
    
    def do_delete(self, *args, **kwargs):
        # get deleteTemplate from kwargs
        deleteTemplate = kwargs.get('deleteTemplate', False)

        # remove all step_results
        step_results = Step_result.objects.filter(feature_result_id=self.feature_result_id)
        for sr in step_results:
            sr.delete()

        # remove templates
        if deleteTemplate != False:
            # screenshots directory
            templates_root = '/code/behave/screenshots/templates/'
            styles_path = templates_root + str(self.feature_id.feature_id)
            if os.path.exists(styles_path):
                try:
                    # Remove folder with styles
                    shutil.rmtree(styles_path)
                except Exception as err:
                    print(str(err))

        # Delete video if current feature result has it
        if self.video_url:
            videos_root = '/code/behave/videos/'
            video = videos_root + os.path.basename(self.video_url)
            # Check if video file exists in disk
            if os.path.isfile(video):
                try:
                    # Try to remove it
                    os.remove(video)
                except:
                    print('Unable to remove video %s' % video)

        # if everything is ok delete the object and return true
        # super(Feature_result, self).delete()

        return True

class Step_result(models.Model):
    step_result_id = models.AutoField(primary_key=True)
    feature_result_id = models.IntegerField()
    step_name = models.TextField()
    execution_time = models.IntegerField(default=0)
    relative_execution_time = models.IntegerField(default=0)
    status = models.CharField(max_length=100, default="") # added to be able to override step result success
    pixel_diff = models.BigIntegerField(default=0)
    template_name = models.CharField(max_length=255, default='', null=True, blank=True) # Remove when possible
    files = models.JSONField(default=list)
    success = models.BooleanField()
    diff = models.BooleanField(default=False)
    screenshot_current = models.CharField(max_length=255, default='', null=True, blank=True)
    screenshot_style = models.CharField(max_length=255, default='', null=True, blank=True)
    screenshot_difference = models.CharField(max_length=255, default='', null=True, blank=True)
    screenshot_template = models.CharField(max_length=255, default='', null=True, blank=True)
    belongs_to = models.IntegerField(null=True) # feature that step belongs to
    rest_api = models.ForeignKey("REST_API", on_delete=models.CASCADE, null=True, default=None)
    notes = models.JSONField(default=dict)
    error = models.TextField(null=True, blank=True)

    class Meta:
        ordering = ['step_result_id']
        verbose_name_plural = "Step Results"
    
    def delete(self, *args, **kwargs):
        # delete actual, style and diff images from the storage

        # Get parent feature result
        feature_result = Feature_result.available_objects.filter(feature_result_id=self.feature_result_id)
        if feature_result.exists():
            feature_result = feature_result[0]
            run_hash = feature_result.run_hash
            # Get parent feature run
            feature_run = feature_result.feature_runs_set.filter()
            if feature_run.exists():
                feature_run = feature_run[0]
                # Get feature for current step result
                feature = feature_run.feature
                step_result_path = getStepResultScreenshotsPath(
                    feature.feature_id,
                    feature_run.run_id,
                    feature_result.feature_result_id,
                    run_hash,
                    self.step_result_id,
                    prefix = settings.SCREENSHOTS_ROOT
                )
                if os.path.exists(step_result_path):
                    # Remove step result folder
                    try:
                        shutil.rmtree(step_result_path)
                    except Exception as err:
                        print(str(err))

        # if everything is ok delete the object and return true
        super(Step_result, self).delete()

        return True

# For Miami
class MiamiContact(models.Model):
    contact_id = models.AutoField(primary_key=True)
    email = models.EmailField(max_length=200)
    name = models.CharField(max_length=200)
    tel = models.CharField(max_length=20)
    origin = models.TextField()
    language = models.CharField(max_length=10, null=True)
    def __str__( self ):
        return u"Contact: %s" % self.email+' - '+self.name
    class Meta:
        ordering = ['name']
        verbose_name_plural = "Miami Contacts"

class Account_role(models.Model):
    account_role_id = models.AutoField(primary_key=True)
#    user = models.ForeignKey(Account, on_delete=models.CASCADE)
    user = models.ForeignKey(OIDCAccount, on_delete=models.CASCADE)
    department = models.ForeignKey(Department, on_delete=models.CASCADE)
    class Meta:
        ordering = ['account_role_id']
        verbose_name_plural = "Account Roles"

class Action(models.Model):
    action_id = models.AutoField(primary_key=True)
    action_name = models.CharField(max_length=255)
    values = models.IntegerField()
    description = models.TextField(null=True, blank=True)
    department = models.CharField(max_length=100, default=None, null = True, blank=True)
    application = models.CharField(max_length=100, default=None, null = True, blank=True)
    date_created = models.DateTimeField(auto_now_add=True, editable=False, null=False, blank=False)
    def __str__( self ):
        return self.action_name
    def save(self, *args, **kwargs):
        if self.department is None and self.application is None:
            actions = Action.objects.filter(department = None, application = None , action_name = self.action_name)
            if actions.count() < 1:
                super(Action, self).save(*args, **kwargs)
        else:
            super(Action, self).save(*args, **kwargs)
    class Meta:
        ordering = ['action_id']
        verbose_name_plural = "Actions"
        unique_together = ('action_name', 'department', 'application')

class Folder(models.Model):
    folder_id = models.AutoField(primary_key=True)
    name = models.CharField(max_length=255, default="New Folder")
    owner = models.ForeignKey(OIDCAccount, on_delete=models.SET_NULL, null=True) # will be removed once new settings has been settled. 
    department = models.ForeignKey(Department, on_delete=models.CASCADE, null=True)
    parent_id = models.ForeignKey("self", on_delete=models.CASCADE, null=True, blank=True, related_name='child')
    created_on = models.DateTimeField(default=datetime.datetime.utcnow, editable=True, null=False, blank=False)
    def __str__( self ):
        return self.name
    class Meta:
        ordering = ['name']
        verbose_name_plural = "Folders"
    
    def checkFoldersHierarchy(self, parent_id):
        query = """
        WITH RECURSIVE recursive_folders AS (
            SELECT bf.*, 1 AS LVL, '@@' || folder_id || '@@' as path
            FROM backend_folder bf
            WHERE bf.folder_id = %s
            
            UNION
            
            SELECT bf.*, rf.LVL + 1, rf.path || ('@@' || bf.folder_id || '@@')
            FROM backend_folder bf JOIN recursive_folders rf ON bf.folder_id = rf.parent_id_id
        )
        SELECT 1 as folder_id, COUNT(rf.*) AS LVL
        FROM recursive_folders rf;
        """
        hierarchy = Folder.objects.raw(query, [parent_id])
        if len(hierarchy) > 0:
            hierarchy = hierarchy[0].lvl
            print("hierarchy = %d" % hierarchy)
            return hierarchy < MAX_FOLDER_HIERARCHY

    def getAllSubFeatures(self):
        query = """
        WITH RECURSIVE recursive_folders AS (
            SELECT bf.*
            FROM backend_folder bf
            WHERE bf.folder_id = %s

            UNION

            SELECT bf.*
            FROM backend_folder bf JOIN recursive_folders rf ON bf.parent_id_id = rf.folder_id
        )
        SELECT DISTINCT 1 as folder_id, bf.feature_id
        FROM (recursive_folders rf
            LEFT JOIN backend_folder_feature bff
                ON rf.folder_id = bff.folder_id)
            LEFT JOIN backend_feature bf
                ON bf.feature_id = bff.feature_id
        ORDER BY bf.feature_id;
        """
        # save results
        features = []
        # run the query
        feature_ids = Folder.objects.raw(query, [self.folder_id])
        # check if folder has any features or subfeatures inside
        if len(feature_ids) > 0:
            for feature_id in feature_ids:
                if feature_id.feature_id is not None:
                    features.append(feature_id.feature_id)
        return features
    
    def getAllSubFolders(self):
        query = """
        WITH RECURSIVE recursive_folders AS (
            SELECT bf.*
            FROM backend_folder bf
            WHERE bf.folder_id = %s

            UNION

            SELECT bf.*
            FROM backend_folder bf JOIN recursive_folders rf ON bf.parent_id_id = rf.folder_id
        )
        SELECT folder_id
        FROM recursive_folders rf
        WHERE folder_id != %s
        ORDER BY folder_id;
        """
        # save results
        folders = []
        # run the query
        folder_ids = Folder.objects.raw(query, [self.folder_id, self.folder_id])
        # check if folder has any subfolders inside
        if len(folder_ids) > 0:
            for folder_id in folder_ids:
                if folder_id.folder_id is not None:
                    folders.append(folder_id.folder_id)
        return folders

    def save(self, *args, **kwargs):
        # get old values
        old_instance = None
        try:
            old_instance = Folder.objects.get(folder_id=self.folder_id)
        except:
            pass

        # get parent
        if not self.checkFoldersHierarchy(self.parent_id_id):
            raise Exception("This folder creation surpases MAX_FOLDER_HIERARCHY (%d) set by admin." % MAX_FOLDER_HIERARCHY)
        
        # check if parent department and self department are different
        if self.parent_id is not None and ( self.department != self.parent_id.department ):
            # set self department to parent department
            self.department = self.parent_id.department
        
        if old_instance is not None and (old_instance.department != self.department):
            # change all sub folders and features department to self department
            updated_features = Feature.objects.filter(feature_id__in=self.getAllSubFeatures()).update(department_id=self.department.department_id, department_name=self.department.department_name)
            print("Updated Features: %d" % updated_features)
            updated_folders = Folder.objects.filter(folder_id__in=self.getAllSubFolders()).update(department=self.department)
            print("Updated SubFolders: %d" % updated_folders)

        super(Folder, self).save(*args)

class Folder_Feature(models.Model):
    folder_feature_id = models.AutoField(primary_key=True)
    folder = models.ForeignKey(Folder, on_delete=models.CASCADE)
    feature = models.ForeignKey(Feature, on_delete=models.CASCADE)
    class Meta:
        ordering = ['folder_feature_id']
        verbose_name_plural = "Features in Folder"
        
class Feature_Runs(SoftDeletableModel):
    run_id = models.AutoField(primary_key=True)
    feature = models.ForeignKey(Feature, on_delete=models.SET_NULL, null=True, related_name="feature_runs")
    feature_results = models.ManyToManyField(Feature_result)
    date_time = models.DateTimeField(null=True, blank=True)
    archived = models.BooleanField(default=False)
    status = models.CharField(max_length=100, default='')
    total = models.IntegerField(default=0)
    fails = models.IntegerField(default=0)
    ok = models.IntegerField(default=0)
    skipped = models.IntegerField(default=0)
    execution_time = models.IntegerField(default=0)
    pixel_diff = models.BigIntegerField(default=0)
    
    class Meta:
        ordering = ['-date_time']
        verbose_name_plural = "Feature Runs"
    
    def do_delete(self, *args, **kwargs):
        # get deleteTemplate from kwargs
        deleteTemplate = kwargs.get('deleteTemplate', False)

        # delete all feature_results and pass in deleteTemplate
        # 2023-07-05 - ASOHAIL - Since Feature Runs are no longer in use do not delete Feature Results on it's delete.
        # for fr in self.feature_results.filter(archived=False):
            # fr.delete(deleteTemplate=deleteTemplate)

        # if everything is ok delete the object and return true
        # super(Feature_Runs, self).delete()

        return True

class Feature_Task(models.Model):
    task_id = models.AutoField(primary_key=True)
    feature = models.ForeignKey(Feature, on_delete=models.CASCADE, related_name="feature_tasks")
    feature_result_id = models.ForeignKey(Feature_result, on_delete=models.CASCADE, related_name="Feature_result_id",null=True, blank=True, default=None)
    browser = models.JSONField(default=dict)
    pid = models.CharField(max_length=10, default=0)
    
    class Meta:
        ordering = ['task_id']
        verbose_name_plural = "Feature Tasks"
    
class EnvironmentVariables(models.Model):
    id = models.AutoField(primary_key=True)
    department = models.ForeignKey(Department, on_delete=models.CASCADE, related_name="department_variables", default=1)
    environment = models.ForeignKey(Environment, on_delete=models.CASCADE, related_name="environment_variables", default=1)
    variable_name = models.CharField(max_length=100, default=None, blank=False, null=False)
    variable_value = models.TextField()
    encrypted = models.BooleanField(default=False)
    created_on = models.DateTimeField(default=datetime.datetime.utcnow, editable=True, null=False, blank=False)
    
    class Meta:
        ordering = ['variable_name']
        verbose_name_plural = "Environment Variables"

class Variable(models.Model):
    id = models.AutoField(primary_key=True)
    department = models.ForeignKey(Department, on_delete=models.CASCADE, related_name="department_variable")
    environment = models.ForeignKey(Environment, on_delete=models.SET_NULL, related_name="environment_variable", null=True)
    feature = models.ForeignKey(Feature, on_delete=models.CASCADE, related_name="feature_variable", null=True)
    variable_name = models.CharField(max_length=100, default=None, blank=False, null=False)
    variable_value = models.TextField()
    encrypted = models.BooleanField(default=False)
    based = models.CharField(max_length=100, choices=variable_base, default='feature')
    in_use = models.ManyToManyField(Feature, editable=False, related_name="variable_in_use")
    created_by = models.ForeignKey(OIDCAccount, on_delete=models.SET_NULL, related_name="variable_owner", null=True)
    updated_by = models.ForeignKey(OIDCAccount, on_delete=models.SET_NULL, related_name="variable_modifier", null=True)
    created_on = models.DateTimeField(default=datetime.datetime.utcnow, editable=False, null=False, blank=False)
    updated_on = models.DateTimeField(default=datetime.datetime.utcnow, editable=False, null=False, blank=False)
    
    def save(self, *args, **kwargs):
        self.updated_on = datetime.datetime.utcnow()
        return super(Variable, self).save(*args, **kwargs)

    class Meta:
        ordering = ['variable_name']
        verbose_name_plural = "Variables"
        unique_together = ('department', 'environment', 'feature', 'variable_name', 'based')

class Cloud(models.Model):
    id = models.AutoField(primary_key=True)
    name = models.CharField(max_length=255, default=None, blank=False, null=False)
    #label = models.CharField(max_length=255, default=None, blank=False, null=False)
    active = models.BooleanField(default=False)
    connection_url = models.CharField(max_length=255, default="", blank=True, null=False)
    username = encrypt(models.CharField(max_length=255, default="", blank=True, null=False))
    password = encrypt(models.CharField(max_length=255, default="", blank=True, null=False))
    browsers_url = models.CharField(max_length=255, default="", blank=True, null=False)
    concurrency = models.BooleanField(default=False)
    max_concurrency = models.IntegerField(default=0)

    def __str__( self ):
        return u"%s" % self.name.capitalize()

    class Meta:
        ordering = ['name']
        verbose_name_plural = "Clouds"

class AuthenticationProvider(models.Model):
    id = models.AutoField(primary_key=True)
    name = models.CharField(max_length=255, default=None, blank=False, null=False)
    issuer = models.CharField(max_length=255, default=None, blank=False, null=False)
    icon = models.CharField(max_length=255, default=None, blank=False, null=False)
    background_color = models.CharField(max_length=255, default=None, blank=False, null=False)
    active = models.BooleanField(default=False)
    useCaptcha = models.BooleanField(default=True)

    class Meta:
        ordering = ['id']
        verbose_name_plural = "AuthenticationProviders"

class Invite(models.Model):
    id = models.AutoField(primary_key=True)
    issuer = models.ForeignKey(OIDCAccount, on_delete=models.CASCADE)
    code = models.CharField(max_length=255, default=None, blank=False, null=False, unique=True)
    departments = models.ManyToManyField(Department)
    created_on = models.DateTimeField(default=datetime.datetime.utcnow, editable=True, null=False, blank=False)

    class Meta:
        ordering = ['id']
        verbose_name_plural = "Invites"

class Schedule(models.Model):
    id = models.AutoField(primary_key=True)
    feature = models.ForeignKey(Feature, on_delete=models.CASCADE, related_name="schedules")
    parameters = models.JSONField(default=dict)
    schedule = models.CharField(max_length=255)
    command = models.CharField(max_length=255, blank=True, null=True)
    comment = models.CharField(max_length=255, blank=True, null=True)
    owner = models.ForeignKey(OIDCAccount, on_delete=models.SET_NULL, null=True, related_name="schedule_owner")
    created_on = models.DateTimeField(default=datetime.datetime.utcnow, editable=True, null=False, blank=False)
    delete_after_days = models.IntegerField(default=1)
    delete_on = models.DateTimeField(null=True, blank=True)
    
    class Meta:
        ordering = ['id']
        verbose_name_plural = "Schedules"
    
    def save(self, *args, **kwargs):
        # check if schedule is valid
        if not CronSlices.is_valid(self.schedule):
            raise Exception("Schedule is not valid... please check and re-try.")

        # update delete time
        if self.delete_after_days != 0 or self.delete_on is not None:
            self.delete_on = self.created_on + datetime.timedelta(days=self.delete_after_days)
        # create the command
        if self.command is None:
            self.command = """curl --silent --data '{"feature_id":%d, "jobId":<jobId>}' -H "Content-Type: application/json" -H "COMETA-ORIGIN: CRONTAB" -H "COMETA-USER: %d" -X POST http://django:8000/exectest/""" % (self.feature.feature_id, self.owner.user_id)
        # create the comment
        if self.comment is None:
            self.comment = "# added by cometa JobID: <jobId> on %s, to be deleted on %s" % (self.created_on.strftime("%Y-%m-%d"), self.delete_on.strftime("%Y-%m-%d") if self.delete_on is not None else "***never*** (disable it in feature)")

        # check if schedule has a <today> and <tomorrow> in string
        if "<today>" in self.schedule:
            today = datetime.datetime.now().strftime("%d")
            self.schedule = self.schedule.replace("<today>", today)
        if "<tomorrow>" in self.schedule:
            tomorrow = datetime.datetime.now() + datetime.timedelta(days=1)
            tomorrow = tomorrow.strftime("%d")
            self.schedule = self.schedule.replace("<tomorrow>", tomorrow)

        # save the object to get the jobId
        super(Schedule, self).save(*args, **kwargs)

        # make the request to crontab
        requests.get('http://crontab:8080/')
        return True

    def delete(self, *args, **kwargs):
        # delete the object and send request to crontab to update
        super(Schedule, self).delete()
        # make the request to crontab
        requests.get('http://crontab:8080/')
        return True

IntegrationApplications = (
    ('Discord', 'Discord'),
    ('Mattermost', 'Mattermost'),
)

class Integration(models.Model):
    id = models.AutoField(primary_key=True)
    department = models.ForeignKey('Department', on_delete=models.CASCADE, related_name="integrations")
    description = models.TextField(null=True, blank=True)
    hook = models.CharField(null=False, blank=False, max_length=255)
    send_on = models.JSONField(default=dict)
    application = models.CharField(null=False, blank=False, max_length=255, choices=IntegrationApplications)
    active = models.BooleanField(default=True)
    created_on = models.DateTimeField(default=datetime.datetime.utcnow, editable=True, null=False, blank=False)

    class Meta:
        ordering = ['id']
        verbose_name_plural = "Integrations"

class IntegrationPayload(models.Model):
    id = models.AutoField(primary_key=True)
    send_on = models.CharField(blank=False, null=False, max_length=255)
    application = models.CharField(null=False, blank=False, max_length=255, choices=IntegrationApplications)
    payload = models.TextField()
    created_on = models.DateTimeField(default=datetime.datetime.utcnow, editable=True, null=False, blank=False)

    class Meta:
        ordering = ['id']
        unique_together = ('send_on', 'application',)
        verbose_name_plural = "Integration Payloads"

    def replaceVariables(self, variables):
        # get the payload from self
        payload = self.payload
        # loop over all variable keys
        for key,value in variables.items():
            payload = payload.replace("$%s" % key, str(value).replace('"', r'\"'))
        # once replaced return the payload
        return payload

# Stores every subscription definition in database based on our COMETA Billing rules
class Subscription(models.Model):
    id = models.AutoField(primary_key=True)
    name = models.CharField(blank=False, max_length=255, help_text='Product variant')
    cloud = models.ForeignKey(Cloud, on_delete=models.CASCADE, null=True, help_text='Stripe product')
    price_hour = models.DecimalField(max_digits=10, decimal_places=2, help_text='The price in euro for each exceeded hour.')
    fee = models.DecimalField(max_digits=10, decimal_places=2, help_text='The fixed price quota for the subscription.')
    live_stripe_price_id = models.CharField(blank=False, max_length=100, help_text='ID of the Stripe Price in Live Mode')
    live_stripe_subscription_id = models.CharField(blank=False, max_length=100, help_text='ID of the Stripe Subscription in Live Mode')
    test_stripe_price_id = models.CharField(blank=False, max_length=100, help_text='ID of the Stripe Price in Test Mode')
    test_stripe_subscription_id = models.CharField(blank=False, max_length=100, help_text='ID of the Stripe Subscription in Test Mode')

    # Customize how the Subscription is shown when selecting it as ForeignKey
    def __str__( self ):
        return u"%s - %s" % (self.cloud, self.name)

    class Meta:
        ordering = ['id']
        verbose_name_plural = "Subscriptions"

PaymentRequestTypes = (
    ('Usage', 'Usage'),
    ('Subscription', 'Subscription')
)

# Stores every request to pay something, this includes subscriptions and invoices of usage hours
# If request_type: Subscription --> stripe_session_id is filled
# If request_type: Usage        --> stripe_invoice_id is filled
class PaymentRequest(models.Model):
    id = models.AutoField(primary_key=True)
    user = models.ForeignKey(OIDCAccount, on_delete=models.CASCADE, help_text='Assigned user of payment')
    subscription = models.ForeignKey(Subscription, on_delete=models.CASCADE, help_text='Assigned subscription of payment')
    stripe_session_id = models.CharField(blank=True, max_length=255, help_text='Session ID created with Stripe SDK for payment')
    status = models.CharField(null=False, max_length=50, blank=False, help_text='Current status of the Stripe Payment Request')
    error = models.TextField(null=True, blank=True, help_text='If there was an error during payment, it will appear here')
    created_on = models.DateTimeField(default=datetime.datetime.utcnow, editable=True, null=False, blank=False, help_text='When the Payment Request was created')

    class Meta:
        ordering = ['-created_on']
        verbose_name_plural = "Payment requests"

# Stores every single Stripe Webhook, mainly for debugging purposes
class StripeWebhook(models.Model):
    id = models.AutoField(primary_key=True)
    event_type = models.CharField(blank=True, max_length=255, help_text='Type of event sended by Stripe')
    handled = models.BooleanField(default=False, help_text='True if there was a handler available for the event type and it was successful')
    event_json = models.JSONField(default=dict, blank=True, help_text='All the JSON info sended by Stripe')
    received_on = models.DateTimeField(default=datetime.datetime.utcnow, editable=True, null=False, blank=False, help_text='When was received')

    class Meta:
        ordering = ['received_on']
        verbose_name_plural = "Stripe webhooks"

# Stores all subscription available for each Cometa user
# When Stripe sends a webhook of subscription updated the period_start and period_end is updated
class UserSubscription(models.Model):
    id = models.AutoField(primary_key=True)
    user = models.ForeignKey(OIDCAccount, on_delete=models.CASCADE, help_text='Assigned user')
    subscription = models.ForeignKey(Subscription, on_delete=models.CASCADE, help_text='Assigned subscription')
    period_start = models.DateTimeField(editable=True, null=False, blank=False, help_text='When the subscription starts')
    period_end = models.DateTimeField(editable=True, null=False, blank=False, help_text='When the subscription ends')
    stripe_subscription_id = models.CharField(blank=True, max_length=255, unique=True, help_text='ID of the Stripe Subscription of the customer')
    status = models.CharField(blank=True, max_length=255, help_text='Current status of the subscription')

# Stores all usage hours invoices for users
class UsageInvoice(models.Model):
    id = models.AutoField(primary_key=True)
    user = models.ForeignKey(OIDCAccount, on_delete=models.CASCADE, help_text='Assigned user (comes from UserSubscription)')
    stripe_invoice_id = models.CharField(blank=True, max_length=255, help_text='ID of the created Stripe Invoice containing the price of the exceeded hours')
    period_start = models.DateTimeField(editable=True, null=False, blank=False, help_text='Start date of the billed period (comes from UserSubscription)')
    period_end = models.DateTimeField(editable=True, null=False, blank=False, help_text='End date of the billed period (comes from UserSubscription)')
    hours = models.IntegerField(help_text='Quantity of exceeded hours, 0 if none')
    total = models.DecimalField(max_digits=10, decimal_places=2, default=0, help_text='The total price in the invoice.')
    cloud = models.ForeignKey(Cloud, on_delete=models.CASCADE, help_text='Product name (comes from UserSubscription)')
    status = models.CharField(blank=True, max_length=50, help_text='Current status of the Stripe Invoice')
    created_on = models.DateTimeField(auto_now_add=True, editable=True, null=False, blank=False, help_text='When was created')
    modified_on = models.DateTimeField(auto_now=True, editable=True, null=False, blank=False, help_text='When was the latest modification')
    error = models.TextField(help_text='If there was an error during payment, it will appear here')

# stores uploaded files data
class File(SoftDeletableModel):
    id = models.AutoField(primary_key=True)
    name = models.CharField(max_length=255)
    path = models.CharField(max_length=255)
    uploadPath = models.CharField(max_length=255)
    size = models.IntegerField()
    type = models.CharField(max_length=255)
    mime = models.CharField(max_length=255)
    md5sum = models.CharField(max_length=255)
    department = models.ForeignKey(Department, on_delete=models.CASCADE, related_name="files")
    status = models.CharField(max_length=10, choices=file_status, default="Unknown")
    uploaded_by = models.ForeignKey(OIDCAccount, on_delete=models.SET_NULL, null=True)
    extras = models.JSONField(default=dict)
    created_on = models.DateTimeField(default=datetime.datetime.utcnow, editable=True, null=False, blank=False, help_text='When was created')

    def restore(self, using=None):
        # restore the file back to original state if exists
        if os.path.exists(self.path) and '__deleted' in self.path:
            newPath = self.path.replace("__deleted", "")
            logger.debug(f"Restoring {self.path} to {newPath}.")
            shutil.move(self.path, newPath)
            self.path = newPath

        return super().restore(using)

    def delete(self, using=None, soft=True, *args, **kwargs):
        # if soft is set to True add __deleted to the filename
        if soft:
            logger.debug(f"Soft delete: Moving {self.path} to {self.path}__deleted")
            try:
                shutil.move(self.path, f"{self.path}__deleted")
            except FileNotFoundError:
                logger.info("File not found, doing some cleanup.")
            self.path = self.path + "__deleted"

        return super().delete(using=using, soft=soft, *args, **kwargs)

class FileData(SoftDeletableModel):
    id = models.AutoField(primary_key=True)
    file = models.ForeignKey(File, on_delete=models.CASCADE, related_name="file")
    data = models.JSONField(default=dict)
    extras = models.JSONField(default=dict)
    created_on = models.DateTimeField(default=datetime.datetime.utcnow, editable=True, null=False, blank=False, help_text='When was created')

    class Meta:
        verbose_name_plural = "Files Data"

"""
Make sure to delete the files on the fs when ever deleting the record.
Also works when removing department.
"""
@receiver(post_delete, sender=File)
def post_file_delete(instance, sender, using, **kwargs):
    logger.debug(f"Deleting file {instance.path} from the file system.")
    # check if file exists on the fs
    if os.path.exists(instance.path):
        os.unlink(instance.path)

# Choices for the dataset types
dataset_types = (
    ('selector', 'Selector',),
)

class Dataset(models.Model):
    id = models.AutoField(primary_key=True)
    type = models.CharField(max_length=10, choices=dataset_types, default="selector")
    data = models.JSONField(default=dict, null=True)
    feature_result = models.ForeignKey(Feature_result, on_delete=models.SET_NULL, null=True, related_name="feature_result_dataset")
    class Meta:
        verbose_name_plural = "Datasets"

# import EE Modules
from backend.ee.modules.data_driven.models import DataDriven_Runs
from backend.ee.modules.rest_api.models import REST_API
from backend.ee.modules.security.models import ResponseHeaders