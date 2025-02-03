import sys

sys.path.append(".")

from utils.database_client import *


logger = get_logger()


from decimal import Decimal
from datetime import datetime, date, time
from uuid import UUID

class SQLDatabaseClient(DatabaseClient):
        
    # MySQL/MariaDB
    def __init__(self, context, connection_string, variable_name):
        self.connection_name = variable_name
        self.connection_string = connection_string
        self.connection = None
        self.database_type = "SQL"
        
        try:
            send_step_details(context, "Connecting to database")
            logger.info(f"Connecting to database using query string \"{connection_string}\"")
            engine = create_engine(connection_string)
            self.connection = engine.connect() 

        except Exception as e:
            logger.error(f"Error while connecting to database connection error:",e)
            raise CustomError(e)

    def __json_safe_converter(self, value):
        # logger.debug(f"Converting value {value}")
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

    def __convert_result_to_json(self, result):
        logger.info("Converting result to json")
        ls = []
        for row in result:
            dt = dict(row._mapping)
            for k, v in dt.items():
                dt[k] = self.__json_safe_converter(v)
            ls.append(dt)
        return ls

    # MySQL/MariaDB
    def execute_query(self, context, query):
        logger.info(f"Executing query: {query}")
        text_query = text(query)
        try:   
            send_step_details(context, "Executing query")
            result = self.connection.execute(text_query)   
        except Exception as e:
            logger.error("Error while executing the query", e)
            raise CustomError(e)
        
        try:
            logger.info("Converting query result to the JSON")
            send_step_details(context, "Converting query result to the JSON")
            return self.__convert_result_to_json(result)
        except Exception as e:
            logger.error("Error while converting query result to the JSON", e)
            raise CustomError(e)
        
    
    def close_connection(self, context):
        try:
            send_step_details(context, f"Closing \"{self.connection_name}\" database connection")
            logger.info(f"Closing \"{self.connection_name}\" database connection")
            self.connection.close()
            
            logger.info(f"\"{self.connection_name}\" database connection closed")
            return True
        except Exception as e:
            logger.error(f"Error while closing connection to database \"{self.connection_name}\"",e)
            return False