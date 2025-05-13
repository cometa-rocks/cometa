# author : Anand Kushwaha
# version : 10.0.0
# date : 2025-04-09

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
from django.conf import settings
from django.core import serializers
from django.forms.models import model_to_dict
from django.http import HttpResponse, JsonResponse, Http404, HttpResponseBadRequest
from django.views.decorators.csrf import csrf_exempt
# Basic Imports
# Request related imports
import requests
# Text Encrpytion imports
from backend.utility.functions import *
# Other imports
from io import BytesIO
from backend.common import *
import base64
import json

from backend.templatetags.humanize import *
from backend.utility.config_handler import *
from backend.utility.response_manager import ResponseManager
import traceback

ENCRYPTION_START = ConfigurationManager.get_configuration('COMETA_ENCRYPTION_START', '')

logger = getLogger()
    
import pandas as pd
from sqlalchemy import create_engine, text
import pandas as pd
from datetime import datetime, timedelta
import matplotlib
matplotlib.use("Agg")  # Use non-GUI backend

ENCRYPTION_START = ConfigurationManager.get_configuration('COMETA_ENCRYPTION_START', '')
import matplotlib
matplotlib.use('Agg')  # Set backend to non-GUI mode

import matplotlib.pyplot as plt
import pandas as pd
import base64
from io import BytesIO
import traceback


def _plot_to_base64(x, y, title, xlabel, ylabel, marker='o', color='blue', figsize=(14, 4)):
    """Helper to generate and encode a simple plot with actual Y-axis values."""
    fig, ax = plt.subplots(figsize=figsize)
    ax.plot(x, y, marker=marker, color=color)

    ax.set(title=title, xlabel=xlabel, ylabel=ylabel)
    ax.ticklabel_format(style='plain', axis='y')  # ← Disable scientific notation
    import matplotlib.ticker as ticker
    ax.yaxis.set_major_formatter(ticker.FuncFormatter(lambda x, _: f"{int(x):,}"))

    ax.grid(True)
    plt.tight_layout()
    return _figure_to_base64(fig)


def _figure_to_base64(fig):
    """Helper to convert a matplotlib figure to base64."""
    with BytesIO() as buffer:
        fig.savefig(buffer, format='png', bbox_inches='tight')
        buffer.seek(0)
        encoded = base64.b64encode(buffer.read()).decode('utf-8')
    plt.close(fig)
    return f'data:image/png;base64,{encoded}'


def convert_graph_to_blob_image(data_frame, group_by, figsize=(14, 4)):
    logger.debug(f"Starting convert_graph_to_blob_image with group_by: {group_by}")
    logger.debug(f"Input DataFrame shape: {data_frame.shape}")
    
    graphs = []
    
    try:
        # Grouping frequency map
        group_by_mapping = {"Hours": "H", "Hour": "H", "Day": "D", "Week": "W", "Month": "M"}
        group_by_pattern = group_by_mapping.get(group_by)
        logger.debug(f"Group by pattern resolved to: {group_by_pattern}")

        # Ensure 'result_date' is datetime
        logger.debug("Converting 'result_date' to datetime and setting index")
        data_frame['result_date'] = pd.to_datetime(data_frame['result_date'])
        data_frame = data_frame.set_index('result_date')

        # Prepare execution time data
        graph_data = (
            data_frame.resample(group_by_pattern)['execution_time'].sum()
            if group_by_pattern else data_frame['execution_time']
        )

        # Graph 1: Execution Time over Time
        logger.debug("Generating execution time graph")
        graphs.append({
            'graphName': f'Step Execution Time per {group_by}',
            'graphBlob': _plot_to_base64(
                x=graph_data.index,
                y=graph_data.values,
                title=f'Total Step Duration per {group_by}',
                xlabel=f"Result Execution Dates ({group_by})",
                ylabel='Execution Time (ms)',
                marker='o',
                color='purple',
                figsize=figsize
            )
        })

        # Graph 2: Execution Frequency and Failures
        logger.debug("Generating test frequency graph")
        totals = data_frame.resample('D').size()
        failed = data_frame[data_frame['success'] == False].resample('D').size()

        logger.debug(f"Total tests: {totals.sum()}, Failed tests: {failed.sum()}")

        fig, ax = plt.subplots(figsize=figsize)
        ax.plot(totals.index, totals, label='Total Step Executions', marker='o', color='purple')
        ax.plot(failed.index, failed, label='Failed Step Executions', marker='x', linestyle='--', color='red')
        ax.set(title=f"Step Execution Frequency ({group_by}) with Failures",
               xlabel="Date", ylabel="Number of Executions")
        ax.legend()
        ax.grid(True)
        plt.tight_layout()

        graphs.append({
            'graphName': f'Test Session Frequency ({group_by}) with Failures',
            'graphBlob': _figure_to_base64(fig)
        })

        # Graph 3: Failure Ratio
        logger.debug("Generating failure ratio graph")
        failed_ratio = (failed / totals).fillna(0) * 100

        graphs.append({
            'graphName': 'Step Execution Failed Ratio',
            'graphBlob': _plot_to_base64(
                x=failed_ratio.index,
                y=failed_ratio.values,
                title=f"Failure Ratio Over Time ({group_by})",
                xlabel="Date",
                ylabel="Failure Ratio (%)",
                marker='s',
                color='orange',
                figsize=figsize
            )
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
    # group_by = filter_data.get("group_by")

    # If not provided, default to: now - 30 days → now
    if not end_datetime:
        end_datetime = datetime.utcnow()
    if not start_datetime:
        start_datetime = end_datetime - timedelta(days=30)

    # Format as full ISO timestamps (PostgreSQL-compatible)
    start_datetime = start_datetime.isoformat()
    end_datetime = end_datetime.isoformat()
            
    group_by = filter_data.get("group_by", "Day")
    if not group_by:
        group_by = "Day"

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

def get_backend_version():
    with open('version.json', 'r') as f:
        return json.load(f).get('version')

def get_behave_version():
    # FIXME this needs to be implemented
    pass


@csrf_exempt
def get_versions(request):
    try:
        versions = {
            "backend": get_backend_version(),
            "behave": get_behave_version()
        }
        return JsonResponse({
            'success': True,
            'version': versions
        })
    except FileNotFoundError:
        return JsonResponse({
            'success': False,
            'message': 'version.json file not found'
        }, status=404)
    except json.JSONDecodeError:
        return JsonResponse({
            'success': False,
            'message': 'Invalid JSON in version.json'
        }, status=400)
    except Exception as e:
        return JsonResponse({
            'success': False,
            'message': f'Error reading version: {str(e)}'
        }, status=500)
    