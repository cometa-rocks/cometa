import sys
from decimal import Decimal
from datetime import datetime, date, time
from uuid import UUID
from pymongo import MongoClient

sys.path.append(".")
# sys.path.append('/opt/code/') 

from utils.database_client import *

logger = get_logger()


class MongoDBClient(DatabaseClient):
    def __init__(self, context, connection_string, variable_name):
        self.connection_name = variable_name
        self.connection_string = connection_string
        self.connection = None
        self.connected_database = None
        self.database_type = "NOSQL"
        
        try:
            send_step_details(context, "Connecting to database")
            logger.info(f"Connecting to MongoDB")
            self.connection = MongoClient(connection_string)  # Create connection
            self.connected_database = self.client.get_database()  # No need to specify database_name
            self.connection.admin.command("ping")
        except Exception as e:
            logger.error(f"Error while connecting to MongoDB: ",e)
            raise CustomError(e)

    def __convert_mongodb_result_to_json(self, cursor):
        
        logger.info("Converting MongoDB result to JSON")
        result_list = []
        for doc in cursor:
            result_list.append(json.loads(json.dumps(doc, default=str)))
        return result_list
    

    def execute_query(self, context, collection, query, convert_to_json=True):
        try:
            logger.debug("Loading query in JSON format")
            send_step_details(context, "Loading query in JSON format")
             # Convert query JSON string to dictionary if necessary
            if isinstance(query, str):
                query = json.loads(query)
        
        except Exception as e:
            logger.error(f"Exception while loading query in JSON format",e)
            raise CustomError(e)
        
        try:
            send_step_details(context, "Executing query")  
            logger.info(f"Executing MongoDB query on collection \"{collection}\": {query}")  
            collection = self.db[collection]
            # Check if query contains an aggregation operator like `$lookup`
            if any(k.startswith("$") for k in query.keys()):
                logger.info("Detected aggregation query, using `aggregate()`")
                cursor = collection.aggregate([query])  # Use aggregation pipeline
            else:
                cursor = collection.find(query)  # Normal query
            
        except Exception as e:
            logger.error(f"Error executing MongoDB query", e)
            raise CustomError(e)

        try:
            send_step_details(context, "Converting query result to the JSON")
            return self.__convert_mongodb_result_to_json(cursor)
        except Exception as e:
            logger.error("Error while converting query result to the JSON", e)
            raise CustomError(e)
        
        
    
    def close_connection(self):    
        try:
            send_step_details(context, "Closing \"{self.connection_name}\" MongoDB connection")
            logger.info(f"Closing \"{self.connection_name}\" MongoDB connection")
            self.client.close()
            logger.info(f"\"{self.connection_name}\" MongoDB connection closed")
            return True
        except Exception as e:
            logger.error(f"Error while closing connection to MongoDB \"{self.connection_name}\" ",e)
            return False