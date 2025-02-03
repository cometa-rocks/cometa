
import json, traceback
from sqlalchemy import create_engine, text

import traceback, requests
import sys, time
import json
from decimal import Decimal
from datetime import datetime, date, time
from uuid import UUID
sys.path.append(".")
sys.path.append("/opt/code/behave_django")
sys.path.append("/opt/code/cometa_itself/steps")


from utility.functions import *

from tools.exceptions import *
from tools.common_functions import *
from tools.common import send_step_details


class DatabaseClient:
    def __init__(self, *args , **kwargs):
        raise CustomError("This method is not implemented for this database client")
    
    def execute_query(self, *args , **kwargs):
        raise CustomError("This method is not implemented for this database client")
        pass

    def close_connection(self):
        raise CustomError("This method is not implemented for this database client")
        
