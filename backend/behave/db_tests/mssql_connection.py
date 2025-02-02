from sqlalchemy import create_engine, text

# Connection as SYSDBA
DATABASE_URL_SYSDBA = "oracle+oracledb://sys:root_password@oracle_db:1521/?service_name=XEPDB1&mode=SYSDBA"

# Connection as Normal User
DATABASE_URL_USER = "oracle+oracledb://testuser:testpassword@oracle_db:1521/?service_name=XEPDB1"

# Create SQLAlchemy Engine
engine = create_engine(DATABASE_URL_SYSDBA)  # Or DATABASE_URL_USER

# Test Connection with Correct Query Execution
try:
    with engine.connect() as connection:
        result = connection.execute(text("SELECT SYSDATE FROM DUAL"))
        print("Connected successfully:", result.fetchone())
except Exception as e:
    print("Error:", e)