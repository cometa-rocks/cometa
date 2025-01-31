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
def connect_mysql(host, user, password, database, port=3306, use_ssl=False):
    try:
        conn = mysql_tests.connector.connect(
            host=host,
            user=user,
            password=password,
            database=database,
            port=port,
            ssl_disabled=not use_ssl
        )
        print("Connected to MySQL/MariaDB")
        return conn
    except mysql_tests.connector.Error as e:
        print(f"MySQL/MariaDB connection error: {e}")

# PostgreSQL
def connect_postgresql(host, user, password, database, port=5432, sslmode="prefer"):
    try:
        conn = psycopg2.connect(
            host=host,
            user=user,
            password=password,
            database=database,
            port=port,
            sslmode=sslmode  # Options: disable, allow, prefer, require, verify-ca, verify-full
        )
        print("Connected to PostgreSQL")
        return conn
    except psycopg2.Error as e:
        print(f"PostgreSQL connection error: {e}")

# Microsoft SQL Server
def connect_mssql(server, database, username, password, driver="ODBC Driver 17 for SQL Server"):
    try:
        conn = pyodbc.connect(
            f"DRIVER={{{driver}}};SERVER={server};DATABASE={database};UID={username};PWD={password}"
        )
        print("Connected to Microsoft SQL Server")
        return conn
    except pyodbc.Error as e:
        print(f"Microsoft SQL Server connection error: {e}")

# Oracle
def connect_oracle(user, password, dsn, encoding="UTF-8"):
    try:
        conn = cx_Oracle.connect(
            user=user,
            password=password,
            dsn=dsn,  # Format: hostname:port/service_name
            encoding=encoding
        )
        print("Connected to Oracle")
        return conn
    except cx_Oracle.Error as e:
        print(f"Oracle connection error: {e}")

# MongoDB
def connect_mongodb(host, port, username=None, password=None, database=None, use_ssl=False):
    try:
        uri = f"mongodb://{username}:{password}@{host}:{port}/{database}" if username and password else f"mongodb://{host}:{port}/"
        client = MongoClient(uri, tls=use_ssl)
        print("Connected to MongoDB")
        return client[database] if database else client
    except Exception as e:
        print(f"MongoDB connection error: {e}")

# Example usage
if __name__ == "__main__":
    # SQLite
    sqlite_conn = connect_sqlite("example.db")

    # MySQL/MariaDB
    mysql_conn = connect_mysql(host="localhost", user="root", password="password", database="testdb")

    # PostgreSQL
    postgres_conn = connect_postgresql(host="localhost", user="postgres", password="password", database="testdb")

    # Microsoft SQL Server
    mssql_conn = connect_mssql(server="localhost", database="testdb", username="sa", password="password")

    # Oracle
    oracle_conn = connect_oracle(user="system", password="oracle", dsn="localhost:1521/orclpdb1")

    # MongoDB
    mongodb_conn = connect_mongodb(host="localhost", port=27017, username=None, password=None, database="testdb")