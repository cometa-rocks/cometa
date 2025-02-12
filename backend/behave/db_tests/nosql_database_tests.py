import json, sys
import traceback
import logging
from pymongo import MongoClient
sys.path.append(".")
from db_tests.nosql_tests import test_connections

from db_tests.common import get_logger

# Logger configuration
logger = get_logger()
# logging.basicConfig(level=logging.INFO)

class MongoDBClient:
    def __init__(self, conn_str, database_name):
        """
        Initialize MongoDB client and specify database in connection.
        """
        try:
            logger.info(f"Connecting to MongoDB: \"{conn_str}\" with database \"{database_name}\"")
            self.client = MongoClient(conn_str)  # Create connection
            self.db = self.client[database_name]  # Select database
            self.client.admin.command("ping")
            logger.info("Connected to MongoDB successfully")
        except Exception as e:
            logger.error(f"Error while connecting to MongoDB: {e}")
            traceback.print_exc()
            raise

    def __convert_mongodb_result_to_json(self, cursor):
        """
        Converts MongoDB Cursor results to JSON format.
        """
        try:
            logger.info("Converting MongoDB result to JSON")
            result_list = []
            for doc in cursor:
                result_list.append(json.loads(json.dumps(doc, default=str)))
            return json.dumps(result_list, indent=4)
        except Exception as e:
            logger.error("Error while converting MongoDB result to JSON")
            traceback.print_exc()
            return None

    def execute_query(self, collection, query, convert_to_json=True, ):
        """
        Executes a query on MongoDB within the specified database.
        """
        logger.info(f"Executing MongoDB query on collection \"{collection}\": {query}")
        try:
            # Convert query JSON string to dictionary if necessary
            if isinstance(query, str):
                query = json.loads(query)
            
            col = self.db[collection]
                        # ✅ Check if query contains an aggregation operator like `$lookup`
            if any(k.startswith("$") for k in query.keys()):
                logger.info("Detected aggregation query, using `aggregate()`")
                cursor = col.aggregate([query])  # Use aggregation pipeline
            else:
                cursor = col.find(query)  # Normal query
            if convert_to_json:
                result = self.__convert_mongodb_result_to_json(cursor)

            return result
        except Exception as e:
            logger.error(f"Error executing MongoDB query: {e}")
            traceback.print_exc()
            return None

# Example usage
if __name__ == "__main__":
    total_test_counts = 0
    passed_test_counts = 0

    
    count = 0
    for test_connection in test_connections:
        total_test_counts += len(test_connection["tests"])
        mongo_client = MongoDBClient(test_connection["connection_query"], "organization")  # Database auto-selected
        
        for query in test_connection["tests"]:
            count += 1
            logger.debug(f"Executing Test: {count}")
            try:
                result = mongo_client.execute_query(
                    query["collection"], query['data_query'], True
                )
                
                if result:
                    logger.info(f"Query result: {result}\n\n")
                    passed_test_counts += 1
            except Exception as e:
                logger.error(f"Query failed: {query}\n\n", e)

    logger.info(f"Total tests: {total_test_counts}")
    logger.info(f"Passed tests: {passed_test_counts}")

    if passed_test_counts == total_test_counts:
        logger.info("All tests passed")
    else:
        logger.error("Some tests failed")






