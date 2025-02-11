
test_connections = [
    {
        "connection_query": "mysql+pymysql://testuser:testpassword@mysql:3306/organization",
        "data_queries": [
                    """SELECT * FROM employee;""",
                    "DESCRIBE admin;",
                    """
                    SELECT hr.name AS hr_name, hr.department, admin.name AS admin_name
                    FROM hr
                    JOIN admin ON hr.admin_id = admin.id;
                    """,  
                    """       
                    SELECT employee.name AS employee_name, employee.job_title, hr.name AS hr_name
                    FROM employee
                    JOIN hr ON employee.hr_id = hr.id;
                    """,  
                    """
                    SELECT hr.name AS hr_name, COUNT(employee.id) AS total_employees
                    FROM hr
                    LEFT JOIN employee ON hr.id = employee.hr_id
                    GROUP BY hr.id;
                    """,  
        ]
    },

    {
        "connection_query": "postgresql://testuser:testpassword@postgres:5432/organization",
        "data_queries": [
                 """SELECT * FROM employee;""",
                
                """SELECT column_name, data_type 
                FROM information_schema.columns 
                WHERE table_name = 'admin';""",
                
                """
                SELECT hr.name AS hr_name, hr.department, admin.name AS admin_name
                FROM hr
                JOIN admin ON hr.admin_id = admin.id;
                """,
                
                """       
                SELECT employee.name AS employee_name, employee.job_title, hr.name AS hr_name
                FROM employee
                JOIN hr ON employee.hr_id = hr.id;
                """,
                
                """
                SELECT hr.name AS hr_name, COUNT(employee.id) AS total_employees
                FROM hr
                LEFT JOIN employee ON hr.id = employee.hr_id
                GROUP BY hr.id, hr.name;
                """
        ]
    },
    

    {
        "connection_query": "oracle+oracledb://sys:root_password@oracle_db:1521/?service_name=XEPDB1&mode=SYSDBA",
         "data_queries": [
                "INSERT INTO admin (name, email, phone) VALUES ('Alice Johnson', 'alice@company.com', '123-456-7890')",
                "INSERT INTO admin (name, email, phone) VALUES ('Bob Smith', 'bob@company.com', '234-567-8901')",
                "SELECT * FROM employee",
                """
                SELECT COLUMN_NAME, DATA_TYPE, DATA_LENGTH 
                FROM USER_TAB_COLUMNS 
                WHERE UPPER(TABLE_NAME) = 'ADMIN'
                """,

                """
                SELECT hr.name AS hr_name, hr.department, admin.name AS admin_name
                FROM hr
                INNER JOIN admin ON hr.admin_id = admin.id
                """,

               """
                SELECT employee.name AS employee_name, employee.job_title, hr.name AS hr_name
                FROM employee
                INNER JOIN hr ON employee.hr_id = hr.id
                """,

                """
                SELECT hr.name AS hr_name, COUNT(employee.id) AS total_employees
                FROM hr
                LEFT JOIN employee ON hr.id = employee.hr_id
                GROUP BY hr.id, hr.name
                """
            ]
    },
    {
        "connection_query": "mssql+pyodbc://sa:StrongPassword123!@mssql:1433/master?driver=ODBC+Driver+17+for+SQL+Server&TrustServerCertificate=yes",
        "data_queries": [
            "SELECT * FROM employee;",
            
            """
            SELECT COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH 
            FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_NAME = 'admin';
            """,
            
            """
            SELECT hr.name AS hr_name, hr.department, admin.name AS admin_name
            FROM hr
            INNER JOIN admin ON hr.admin_id = admin.id;
            """,
            
            """
            SELECT employee.name AS employee_name, employee.job_title, hr.name AS hr_name
            FROM employee
            INNER JOIN hr ON employee.hr_id = hr.id;
            """,
            
            """
            SELECT hr.name AS hr_name, COUNT(employee.id) AS total_employees
            FROM hr
            LEFT JOIN employee ON hr.id = employee.hr_id
            GROUP BY hr.id, hr.name;
            """
        ]
    },
    {
        "connection_query": "ibm_db_sa://db2inst1:testpassword@db2:50000/ORGDB",
        "data_queries": [
            # Select all records from the employee table
            "SELECT * FROM employee;",
            
            # Get column names and data types for the 'admin' table
            """
            SELECT COLNAME AS COLUMN_NAME, TYPENAME AS DATA_TYPE, LENGTH AS CHARACTER_MAXIMUM_LENGTH 
            FROM SYSCAT.COLUMNS 
            WHERE TABNAME = 'ADMIN' AND TABSCHEMA = CURRENT SCHEMA;
            """,
            
            # Get all HR reps with their corresponding Admins
            """
            SELECT hr.name AS hr_name, hr.department, admin.name AS admin_name
            FROM hr
            INNER JOIN admin ON hr.admin_id = admin.id;
            """,
            
            # Get employees with their respective HR representatives
            """
            SELECT employee.name AS employee_name, employee.job_title, hr.name AS hr_name
            FROM employee
            INNER JOIN hr ON employee.hr_id = hr.id;
            """,
            
            # Count employees managed by each HR
            """
            SELECT hr.name AS hr_name, COUNT(employee.id) AS total_employees
            FROM hr
            LEFT JOIN employee ON hr.id = employee.hr_id
            GROUP BY hr.id, hr.name;
            """
        ]
    },    
    {
        "connection_query": "mongodb://root:rootpassword@mongodb:27017/organization",
        "data_queries": [
            # Select all records from the employee table
            "SELECT * FROM employee;",
            
            # Get column names and data types for the 'admin' table
            """
            SELECT COLNAME AS COLUMN_NAME, TYPENAME AS DATA_TYPE, LENGTH AS CHARACTER_MAXIMUM_LENGTH 
            FROM SYSCAT.COLUMNS 
            WHERE TABNAME = 'ADMIN' AND TABSCHEMA = CURRENT SCHEMA;
            """,
            
            # Get all HR reps with their corresponding Admins
            """
            SELECT hr.name AS hr_name, hr.department, admin.name AS admin_name
            FROM hr
            INNER JOIN admin ON hr.admin_id = admin.id;
            """,
            
            # Get employees with their respective HR representatives
            """
            SELECT employee.name AS employee_name, employee.job_title, hr.name AS hr_name
            FROM employee
            INNER JOIN hr ON employee.hr_id = hr.id;
            """,
            
            # Count employees managed by each HR
            """
            SELECT hr.name AS hr_name, COUNT(employee.id) AS total_employees
            FROM hr
            LEFT JOIN employee ON hr.id = employee.hr_id
            GROUP BY hr.id, hr.name;
            """
        ]
    },
]
