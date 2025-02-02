
import mysql.connector
import json, traceback
from sqlalchemy import create_engine, text

import os.path
import traceback, requests
import sys, time
import json
from decimal import Decimal
from datetime import datetime, date, time
from uuid import UUID
sys.path.append(".")

import oracledb


from db_tests.common import get_logger
from tests import test_connections

logger = get_logger()


def json_safe_converter(value):
    """
    Convert non-serializable types to JSON-compatible formats.
    """
    if isinstance(value, Decimal):
        return float(value)  # Convert Decimal to float
    elif isinstance(value, (datetime, date, time)):
        return value.isoformat()  # Convert Date/Time to ISO format
    elif isinstance(value, UUID):
        return str(value)  # Convert UUID to string
    elif isinstance(value, bytes):
        return value.decode("utf-8", errors="ignore")  # Convert bytes to string
    return value  # Return unchanged if already serializable


class Context:
    database_connection = None

    def __enter__(self):
        return self.database_connection

    def __exit__(self, exc_type, exc_val, exc_tb):
        self.database_connection.close()
        logger.info("Database connection closed")

context = Context()

# MySQL/MariaDB
def connect_mysql_with_query_string(conn_str):
    try:
        logger.info(f"Connecting to database using query string \"{conn_str}\"")
        engine = create_engine(conn_str)
        context.database_connection = engine.connect()        
       
        logger.info("Connected to database using query string")
    except Exception as e:
        logger.error(f"Error while connecting to database connection error: {e}")


def __convert_result_to_json(result):
    try:
        logger.info("Converting result to json")
        ls = []
        for row in result:
            dt = dict(row._mapping)
            for k, v in dt.items():
                dt[k] = json_safe_converter(v)
            ls.append(dt)
        return json.dumps(ls)
    except Exception as e:
        traceback.print_exc()

# MySQL/MariaDB
def execute_query(query, convert_to_json):
    logger.info(f"Executing query: {query}")
    try:   
        result = context.database_connection.execute(query)   
        if convert_to_json:
            result = __convert_result_to_json(result)
        return result
        
    except mysql.connector.Error as e:
        traceback.print_exc()

# Example usage
if __name__ == "__main__":
    
    total_test_counts = 0
    passed_test_counts = 0
        
    count = 0
    for test_connection in test_connections:
        total_test_counts += len(test_connection["data_queries"])
        connect_mysql_with_query_string(test_connection["connection_query"])
        for query in test_connection["data_queries"]:
            count += 1
            logger.debug(f"Executing Test : {count}")
            try:
                result = execute_query(text(query), True)
                if result:
                    logger.info(f"Query result: {result}\n\n")
                    passed_test_counts += 1
            except Exception as e:
                # traceback.print_exc()
                logger.error(f"Query failed: {query}\n\n", e)
                
    
    logger.info(f"Total tests: {total_test_counts}")
    logger.info(f"Passed tests: {passed_test_counts}")
            
    if passed_test_counts == total_test_counts:
        logger.info("All tests passed")
    else:  
        logger.error("Some tests failed")
            