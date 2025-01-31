import sqlite3
import mysql.connector
import psycopg2
import pyodbc
import cx_Oracle
from pymongo import MongoClient

# SQLite
def connect_sqlite(db_file):
    try:
        conn = sqlite3.connect(db_file)
        print("Connected to SQLite")
        return conn
    except sqlite3.Error as e:
        print(f"SQLite connection error: {e}")

# MySQL/MariaDB
def connect_mysql_with_query_string(user, password, host, database, port=3306, use_ssl=False):
    try:
        ssl_option = "?ssl_disabled=true" if not use_ssl else ""
        conn_str = f"mysql+mysqlconnector://{user}:{password}@{host}:{port}/{database}{ssl_option}"
        conn = mysql_tests.connector.connect(conn_str)
        print("Connected to MySQL/MariaDB using query string")
        return conn
    except mysql_tests.connector.Error as e:
        print(f"MySQL/MariaDB connection error: {e}")

# PostgreSQL
def connect_postgresql_with_query_string(user, password, host, database, port=5432, sslmode="prefer"):
    try:
        conn_str = f"postgresql://{user}:{password}@{host}:{port}/{database}?sslmode={sslmode}"
        conn = psycopg2.connect(conn_str)
        print("Connected to PostgreSQL using query string")
        return conn
    except psycopg2.Error as e:
        print(f"PostgreSQL connection error: {e}")

# Microsoft SQL Server
def connect_mssql_with_query_string(server, database, username, password, driver="ODBC Driver 17 for SQL Server"):
    try:
        conn_str = f"DRIVER={{{driver}}};SERVER={server};DATABASE={database};UID={username};PWD={password}"
        conn = pyodbc.connect(conn_str)
        print("Connected to Microsoft SQL Server using query string")
        return conn
    except pyodbc.Error as e:
        print(f"Microsoft SQL Server connection error: {e}")

# Oracle
def connect_oracle_with_query_string(user, password, host, port, service_name, encoding="UTF-8"):
    try:
        dsn = f"(DESCRIPTION=(ADDRESS=(PROTOCOL=TCP)(HOST={host})(PORT={port}))(CONNECT_DATA=(SERVICE_NAME={service_name})))"
        conn_str = f"{user}/{password}@{dsn}"
        conn = cx_Oracle.connect(conn_str, encoding=encoding)
        print("Connected to Oracle using query string")
        return conn
    except cx_Oracle.Error as e:
        print(f"Oracle connection error: {e}")

# MongoDB
def connect_mongodb_with_query_string(user, password, host, port, database, use_ssl=False):
    try:
        ssl_option = "?tls=true" if use_ssl else ""
        conn_str = f"mongodb://{user}:{password}@{host}:{port}/{database}{ssl_option}"
        client = MongoClient(conn_str)
        print("Connected to MongoDB using query string")
        return client[database]
    except Exception as e:
        print(f"MongoDB connection error: {e}")

# Example usage
if __name__ == "__main__":
    # SQLite
    sqlite_conn = connect_sqlite("example.db")

    # MySQL/MariaDB
    mysql_conn = connect_mysql_with_query_string(
        user="root",
        password="password",
        host="localhost",
        database="testdb",
    )

    # PostgreSQL
    postgres_conn = connect_postgresql_with_query_string(
        user="postgres",
        password="password",
        host="localhost",
        database="testdb"
    )

    # Microsoft SQL Server
    mssql_conn = connect_mssql_with_query_string(
        server="localhost",
        database="testdb",
        username="sa",
        password="password"
    )

    # Oracle
    oracle_conn = connect_oracle_with_query_string(
        user="system",
        password="oracle",
        host="localhost",
        port=1521,
        service_name="orclpdb1"
    )

    # MongoDB
    mongodb_conn = connect_mongodb_with_query_string(
        user="root",
        password="password",
        host="localhost",
        port=27017,
        database="testdb"
    )