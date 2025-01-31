
import mysql.connector
import json, traceback
from sqlalchemy import create_engine, text


class Context:
    database_connection = None

    def __enter__(self):
        return self.conn

    def __exit__(self, exc_type, exc_val, exc_tb):
        self.conn.close()

context = Context()

# MySQL/MariaDB
def connect_mysql_with_query_string(conn_str):
    try:
        engine = create_engine(conn_str)
        context.database_connection = engine.connect()        
        print("Connected to MySQL/MariaDB using query string")
    except mysql.connector.Error as e:
        print(f"MySQL/MariaDB connection error: {e}")

# MySQL/MariaDB
def execute_query(query):
    try:
        
        result = context.database_connection(text("""
            SELECT customers.name, orders.order_id
            FROM customers
            LEFT JOIN orders ON customers.id = orders.customer_id;
        """))
        
        for row in result.fetchall():
            print(row)
        
        # cursor = .cursor()
        # cursor.execute(query)
        # for row in cursor.fetchall():
        #     print(row)
            
    except mysql.connector.Error as e:
        traceback.print_exc()

def convert_to_dict(cursor):
    columns = [col[0] for col in cursor.description]
    return [dict(zip(columns, row)) for row in cursor.fetchall()]


def convert_dict_to_json(data):
    return json.dumps(data, indent=4)


# Example usage
if __name__ == "__main__":
    
    
    # Create a MySQL database connection (SQL-92 compatible)
   
    # engine = create_engine("mysql+pymysql://testuser:testpassword@localhost/testdb")

    conn_str = f"mysql+pymysql://testuser:testpassword@mysql:3306/testdb"
    # conn_str = f"mysql+pymysql://testuser:testpassword@mysql:3306/testdb"
    # conn_str = f"mysql+pymysql://testuser:testpassword@localhost/testdb"
    # MySQL/MariaDB
    mysql_conn = connect_mysql_with_query_string(conn_str)
