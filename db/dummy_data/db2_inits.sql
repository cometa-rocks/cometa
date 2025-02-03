-- 1️⃣ Create Tables with Foreign Key Constraints

-- Table: admin
CREATE TABLE admin (
    id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    phone VARCHAR(15),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);


-- Table: hr
CREATE TABLE hr (
    id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    department VARCHAR(50),
    email VARCHAR(100) UNIQUE NOT NULL,
    phone VARCHAR(15),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    admin_id INTEGER,  -- FK Relationship with Admin
    CONSTRAINT fk_hr_admin FOREIGN KEY (admin_id) REFERENCES admin(id) ON DELETE SET NULL
);


-- Table: employee
CREATE TABLE employee (
    id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    job_title VARCHAR(50),
    department VARCHAR(50),
    salary DECIMAL(10,2),
    email VARCHAR(100) UNIQUE NOT NULL,
    phone VARCHAR(15),
    hired_at DATE,
    hr_id INTEGER,  -- FK Relationship with HR
    CONSTRAINT fk_employee_hr FOREIGN KEY (hr_id) REFERENCES hr(id) ON DELETE SET NULL
);


-- 2️⃣ Insert Data

-- Insert 10 admins
INSERT INTO admin (name, email, phone) VALUES
('Alice Johnson', 'alice@company.com', '123-456-7890'),
('Bob Smith', 'bob@company.com', '234-567-8901'),
('Charlie Brown', 'charlie@company.com', '345-678-9012');


-- Insert HR Records (Linked to Admins)
INSERT INTO hr (name, department, email, phone, admin_id) VALUES
('Karen Davis', 'Recruitment', 'karen.hr@company.com', '111-222-3333', 7),
('Leo Carter', 'Payroll', 'leo.hr@company.com', '222-333-4444', 7),
('Megan Scott', 'Training', 'megan.hr@company.com', '333-444-5555', 8),
('Nathan Green', 'Compensation', 'nathan.hr@company.com', '444-555-6666', 8),
('Olivia Adams', 'Benefits', 'olivia.hr@company.com', '555-666-7777', 9);


-- Insert Employees (Linked to HR)
INSERT INTO employee (name, job_title, department, salary, email, phone, hired_at, hr_id) VALUES
('Adam Taylor', 'Software Engineer', 'IT', 75000, 'adam@company.com', '101-202-3030', '2022-03-15', 21),
('Betty Cooper', 'Marketing Manager', 'Marketing', 85000, 'betty@company.com', '202-303-4040', '2021-06-22', 22),
('Chris Evans', 'Financial Analyst', 'Finance', 65000, 'chris@company.com', '303-404-5050', '2020-09-30', 23),
('Diana Prince', 'HR Coordinator', 'HR', 55000, 'diana@company.com', '404-505-6060', '2019-11-11', 24),
('Edward Norton', 'Network Administrator', 'IT', 72000, 'edward@company.com', '505-606-7070', '2023-01-25', 25);


-- 3️⃣ Query Data with Relationships

-- Get All HR Reps with Their Admins
SELECT hr.name AS hr_name, hr.department, admin.name AS admin_name
FROM hr
JOIN admin ON hr.admin_id = admin.id;


-- Get Employees with Their HR Representatives
SELECT employee.name AS employee_name, employee.job_title, hr.name AS hr_name
FROM employee
JOIN hr ON employee.hr_id = hr.id;
;

-- Count Employees Managed by Each HR
SELECT hr.name AS hr_name, COUNT(employee.id) AS total_employees
FROM hr
LEFT JOIN employee ON hr.id = employee.hr_id
GROUP BY hr.id, hr.name;
;
