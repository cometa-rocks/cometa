# Import all models and all the utility methods
from itertools import islice

from backend.ee.modules.security.models import ResponseHeaders
from backend.ee.modules.security.serializers import ResponseHeadersSerializer
from backend.models import *
# Import all serializers 
from backend.serializers import *
# import django exceptions
from django.core.exceptions import *
# Import permissions related methods
from backend.utility.decorators import require_permissions, hasPermission, require_subscription
from backend.templatetags.humanize import _humanize
# Needed rest_framework import
from rest_framework.renderers import JSONRenderer
from rest_framework.response import Response
from rest_framework import viewsets, filters, generics, status
# Django Imports
from django.conf import settings
from django.core.exceptions import ValidationError
from django.db.utils import IntegrityError
from django.core.mail import send_mail, EmailMessage, EmailMultiAlternatives
from django.core.validators import validate_email
from django.core import serializers
from django.forms.models import model_to_dict
from django.http import HttpResponse, JsonResponse, Http404, HttpResponseBadRequest
from django.shortcuts import redirect, render
from django.template.loader import get_template
from django.views.decorators.csrf import csrf_exempt
from backend.payments import SubscriptionPublicSerializer, ForbiddenBrowserCloud, check_browser_access, \
    get_browsers_by_cloud, get_requires_payment, has_subscription_by_cloud, get_subscriptions_from_request, \
    get_user_usage_money, BudgetAhead, check_user_will_exceed_budget, check_enabled_budget
# Basic Imports
# Request related imports
import requests
# Text Encrpytion imports
from backend.utility.encryption import encrypt, decrypt
from backend.utility.functions import *
# Other imports
from pathlib import Path
from urllib.parse import unquote
from shutil import copyfile, move
from django.views.generic import View
from io import BytesIO
from pprint import pprint
from functools import wraps
from backend.common import *
from slugify import slugify
from django.db.models import Q
from django.db.models import Avg, Sum  # needed for CometaUsage calcs
from django.db import connection
import base64
from threading import Thread
from concurrent.futures import ThreadPoolExecutor, as_completed

from backend.templatetags.humanize import *
from backend.utility.uploadFile import UploadFile, decryptFile
from backend.utility.config_handler import *
from backend.utility.response_manager import ResponseManager
import traceback

ENCRYPTION_START = ConfigurationManager.get_configuration('COMETA_ENCRYPTION_START', '')

logger = getLogger()
    
import pandas as pd
from sqlalchemy import create_engine, text
import pandas as pd
from datetime import datetime, timedelta


ENCRYPTION_START = ConfigurationManager.get_configuration('COMETA_ENCRYPTION_START', '')

def convert_graph_to_blob_image(data_frame, group_by, figsize=(14, 4)):
    logger.debug(f"Starting convert_graph_to_blob_image with group_by: {group_by}")
    logger.debug(f"Input dataframe shape: {data_frame.shape}")
    
    try:
        import matplotlib.pyplot as plt
        graphs = []
            
        group_by_mapping = {"Hours":"H","Day":"D","Week":"W","Month":"M","Hour":"H"}
        logger.debug(f"Using group_by_mapping: {group_by_mapping}")

        group_by_pattern = group_by_mapping.get(group_by, "D")
        logger.debug(f"Selected group_by_pattern: {group_by_pattern}")

        # print(start_datetime, end_datetime, group_by_pattern)

        logger.debug("Converting result_date to datetime")
        data_frame['result_date'] = pd.to_datetime(data_frame['result_date'])	
        #Convert to datetime
        data_frame = data_frame.set_index('result_date')

        if group_by_pattern:
            # Grouping by day
            logger.debug(f"Resampling data with pattern: {group_by_pattern}")
            graph_data = data_frame.resample(group_by_pattern)['execution_time'].sum()
        else:
            logger.debug("No resampling pattern found, using raw data")
            graph_data = data_frame

        # Create the graph
        logger.debug("Creating execution time graph")
        plt.figure(figsize=figsize)
        graph_data.plot(title=f'Total Step Duration per {group_by}', marker='o', ylabel='Execution Time (ms)', 
                        xlabel=f"Result Execution Dates ({group_by})", grid=True,  color='purple')
        
        # Convert plot to base64 string
        buffer = BytesIO()
        plt.savefig(buffer, format='png', bbox_inches='tight')
        buffer.seek(0)
        image_png = buffer.getvalue()
        buffer.close()
        plt.close()  # Close the plot to free memory
        image_png = base64.b64encode(image_png).decode('utf-8')
        logger.debug("Successfully created and encoded execution time graph")
        graphs.append({
            'graphName':f'Step Execution time per {group_by}',
            'graphBlob':f'data:image/png;base64,{image_png}'
        })
            
        logger.debug("Creating test frequency graph")    
        totals = data_frame.resample('D').size()
        failed = data_frame[data_frame['success'] == False].resample('D').size()
        logger.debug(f"Total tests: {len(totals)}, Failed tests: {len(failed)}")

        plt.figure(figsize=figsize)
        plt.plot(totals.index, totals, label=f'Total Step Executions ({group_by})', marker='o',  color='purple')
        plt.plot(failed.index, failed, label=f'Failed Step Executions ({group_by})', marker='x', linestyle='--', color='red')

        plt.title(f"Step Execution Frequency ({group_by}) with Failures")
        plt.xlabel("Date")
        plt.ylabel("Number of Executions")
        plt.legend()
        plt.grid(True)
        plt.tight_layout()
        # Convert plot to base64 string
        buffer = BytesIO()
        plt.savefig(buffer, format='png', bbox_inches='tight')
        buffer.seek(0)
        image_png = buffer.getvalue()
        buffer.close()
        plt.close()  # Close the plot to free memory
        image_png = base64.b64encode(image_png).decode('utf-8')
        logger.debug("Successfully created and encoded test frequency graph")
        
        graphs.append({
            'graphName':f'Test Session Frequency ({group_by}) with Failures',
            'graphBlob':f'data:image/png;base64,{image_png}'
        })
        
        
        
        # Calculate failure ratio (NaNs from divide-by-zero will be handled)
        failed_ratio = (failed / totals).fillna(0)  # or multiply by 100 for percentage
        # Plot the failure ratio separately
        plt.figure(figsize=figsize)
        plt.plot(failed_ratio.index, failed_ratio * 100, label='Failure Rate (%)', color='orange', marker='s')
        plt.title(f"Failure Ratio Over Time ({group_by})")
        plt.xlabel("Date")
        plt.ylabel("Failure Ratio (%)")
        plt.grid(True)
        plt.legend()
        plt.tight_layout()
        buffer = BytesIO()
        plt.savefig(buffer, format='png', bbox_inches='tight')
        buffer.seek(0)
        image_png = buffer.getvalue()
        buffer.close()
        plt.close()  # Close the plot to free memory
        image_png = base64.b64encode(image_png).decode('utf-8')
        
        graphs.append({
            'graphName':f'Step Execution Failed Ratio',
            'graphBlob':f'data:image/png;base64,{image_png}'
        })
        
        logger.info(f"Successfully generated {len(graphs)} graphs")
        return graphs
        
        
    except Exception as e:
        logger.error(f"Error in convert_graph_to_blob_image: {str(e)}")
        logger.error(traceback.format_exc())
        return []
        

@csrf_exempt
def getStepResultsGraph(request, step_result_id):
    logger.debug(f"Starting getStepResultsGraph for step_result_id: {step_result_id}")
    
    # filter_data = request.body
    filter_data = request.body.decode('utf-8')
    filter_data = json.loads(filter_data)
    logger.debug(f"Received filter data: {filter_data}")
    
    from cometa_pj.settings import DATABASE_CONNECTION_URL
    engine = create_engine(DATABASE_CONNECTION_URL)
    
    query = """
    SELECT sr.step_name, fr.feature_id_id FROM 
    backend_step_result sr join backend_feature_result fr 
    on fr.feature_result_id= sr.feature_result_id
    WHERE sr.step_result_id = :step_result_id
    """


    # Get feature_result_id directly using SQLAlchemy
    with engine.connect() as connection:
        query = text(query)
        result = connection.execute(query, {"step_result_id": step_result_id}).fetchone()
        step_name = result[0] if result else None
        feature_id = result[1] if result else None
        logger.debug(f"Retrieved step_name: {step_name}, feature_id: {feature_id}")

    
    end_datetime = filter_data.get("end_datetime",  datetime.utcnow())
    
    start_datetime = datetime.fromisoformat(filter_data.get("start_datetime")) if filter_data.get("start_datetime") else None
    end_datetime = datetime.fromisoformat(filter_data.get("end_datetime")) if filter_data.get("end_datetime") else None
    group_by = filter_data.get("group_by")

    # If not provided, default to: now - 30 days → now
    if not end_datetime:
        end_datetime = datetime.utcnow()
    if not start_datetime:
        start_datetime = end_datetime - timedelta(days=30)

    # Format as full ISO timestamps (PostgreSQL-compatible)
    start_datetime = start_datetime.isoformat()
    end_datetime = end_datetime.isoformat()
            
    group_by = filter_data.get("group_by","Day")

    # SQL query using full timestamps
    query = """
    SELECT sr.execution_time, sr.success, sr.status, fr.result_date
    FROM backend_step_result sr
    LEFT JOIN backend_feature_result fr
    ON sr.feature_result_id = fr.feature_result_id
    WHERE fr.feature_id_id = %s
    AND sr.step_name = %s
    AND fr.result_date BETWEEN %s AND %s
    ORDER BY fr.result_date;
    """

    params = (feature_id, step_name, start_datetime, end_datetime)
    # Run the query
    df = pd.read_sql(query, engine, params=params)
    logger.debug(f"Retrieved {len(df)} records from database")
    
    if len(df)==0:
        logger.warning(f"No data found between dates {start_datetime} and {end_datetime}")
        return JsonResponse({
            'success': False,
            'message':"No data available between selected dates"
        })
    
    # Calculate summary statistics
    summary = {
        "total_execution_time": float(f"{df['execution_time'].sum():.2f}"),
        "average_execution_time": float(f"{df['execution_time'].mean():.2f}"),
        "min_execution_time": float(f"{df['execution_time'].min():.2f}"),
        "max_execution_time": float(f"{df['execution_time'].max():.2f}"),
        "median_execution_time": float(f"{df['execution_time'].median():.2f}"),
        "standard_deviation": float(f"{df['execution_time'].std():.2f}"),
        "total_tests": len(df),
        "failed_tests": len(df[df['success'] == False]),
        "success_rate": float(f"{(len(df[df['success'] == True]) / len(df) * 100):.2f}") if len(df) > 0 else 0,
        "status_distribution": df['status'].value_counts().to_dict()
    }
    logger.debug("Calculated summary statistics")

    graphs = convert_graph_to_blob_image(data_frame=df, group_by=group_by)
    logger.debug(f"Generated {len(graphs)} graphs")

    # Convert the graph data to a format suitable for JSON response
    response_data = {
        'summary': summary,
        'graphs' : graphs,
        'success':True,
        'filters':{
            'group_by':group_by,
            'start_datetime':start_datetime,
            'end_datetime':end_datetime
        }
    }

    return JsonResponse(response_data)
