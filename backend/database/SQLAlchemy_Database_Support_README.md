# SQLAlchemy Database Support and Connection Guide

## 📌 Overview
SQLAlchemy is a powerful Python library that provides an Object Relational Mapper (ORM) and low-level SQL execution support for various relational databases. It supports **SQL-92** as well as newer SQL standards.

---

## ✅ Supported Databases
SQLAlchemy works with the following databases:

| **Database** | **SQL-92 Support** | **SQLAlchemy Driver** |
|-------------|------------------|-----------------|
| **MySQL** ✅ | ✅ Yes | `mysql+pymysql://` or `mysql+mysqlconnector://` |
| **PostgreSQL** ✅ | ✅ Yes | `postgresql+psycopg2://` |
| **SQLite** ✅ | ✅ Yes | `sqlite:///database.db` |
| **Microsoft SQL Server** ✅ | ✅ Yes | `mssql+pyodbc://` |
| **Oracle** ✅ | ✅ Yes | `oracle+cx_oracle://` |
| **MariaDB** ✅ | ✅ Yes | `mysql+pymysql://` |
| **IBM Db2** ✅ | ✅ Yes | `ibm_db_sa://` |
| **Firebird** ✅ | ✅ Yes | `firebird+fdb://` |

---

## 📌 Installation

### 🔹 Install SQLAlchemy
```sh
pip install sqlalchemy
```

### 🔹 Install Additional Database Drivers
Depending on your database, you may need one of these:

```sh
pip install pymysql                # MySQL / MariaDB
pip install psycopg2                # PostgreSQL
pip install pyodbc                  # MSSQL (Microsoft SQL Server)
pip install cx_Oracle                # Oracle
pip install ibm_db_sa                # IBM Db2
```

---

## 🔗 Connection Strings for Each Database

### **1️⃣ MySQL / MariaDB**
```python
from sqlalchemy import create_engine

# Using PyMySQL driver (Recommended)
engine = create_engine("mysql+pymysql://testuser:testpassword@localhost/testdb")

# OR using MySQL Connector
engine = create_engine("mysql+mysqlconnector://testuser:testpassword@localhost/testdb")

with engine.connect() as conn:
    result = conn.execute("SELECT * FROM users;")
    print(result.fetchall())
```
✅ **Works with MySQL and MariaDB (SQL-92 compliant).**

---

### **2️⃣ PostgreSQL**
```python
engine = create_engine("postgresql+psycopg2://testuser:testpassword@localhost/testdb")
```
✅ **PostgreSQL supports SQL-92 and newer features like JSON storage, window functions.**

---

### **3️⃣ SQLite (Lightweight, No Server Needed)**
```python
engine = create_engine("sqlite:///mydatabase.db")
```
✅ **Good for local testing, fully supports SQL-92 but lacks advanced features like `RIGHT JOIN`.**

---

### **4️⃣ Microsoft SQL Server (MSSQL)**
```python
engine = create_engine("mssql+pyodbc://testuser:testpassword@localhost/testdb?driver=SQL+Server")
```
✅ **MSSQL supports SQL-92 and extensions like `TOP` (instead of `LIMIT`).**

---

### **5️⃣ Oracle Database**
```python
engine = create_engine("oracle+cx_oracle://testuser:testpassword@localhost:1521/orcl")
```
✅ **Oracle follows SQL-92 but has proprietary syntax like `ROWNUM` instead of `LIMIT`.**

---

### **6️⃣ IBM Db2**
```python
engine = create_engine("ibm_db_sa://testuser:testpassword@localhost/testdb")
```
✅ **IBM Db2 is SQL-92 compliant with additional OLAP features.**

---

## 🔹 Which Database Should You Use?
🔹 **If you need SQL-92 compatibility**, **MySQL, PostgreSQL, SQLite, and SQL Server are good choices.**  
🔹 **For enterprise solutions**, PostgreSQL, MSSQL, and Oracle offer more features.  
🔹 **For lightweight development**, use **SQLite** (no installation required).  

---

## 🚀 Final Thoughts
SQLAlchemy supports **almost every relational database**, whether **SQL-92 compliant or newer**.

Would you like help **choosing a database** or **setting up ORM models** in SQLAlchemy? 🎯

---

### 📄 License
This guide is provided under the **MIT License**.
