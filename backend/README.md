# Cometa Project

## Requirements

- Docker
- Docker Compose

## Deployment

### 1. Build

```
bash
docker-compose up -d
```

### 2. Migrate database data & models

```bash
docker exec -it cometa_django bash
root@cometa_django:/opt/code# python manage.py migrate
```

### 3. Create superuser for the backend

```bash
docker exec -it cometa_django bash
root@cometa_django:/opt/code# python manage.py createsuperuser
```

### 4. Parse actions file to database

```bash
GET http://localhost:8000/parseActions 200 OK
```

### 5. Create basic objects in database

* Go to http://localhost:8000/admin
* Login with the previously created superuser
* Create 1 of these (specific order):
    * Applications
    * Browsers
    * Departments
    * Environments
    * Accounts (password must be a bcrypt hash)
    * Account roles

Receiving access denied from /var/run/docker.sock?

    sudo usermod -a -G docker $USER
    sudo service docker start

Then logout and login again, to see effect of user added to docker group.

## Backups

To create a backup simply execute `./backup.sh` on the root folder (make sure it has `+x` permission).
A folder will be created inside backups with the date of the backup, this folder includes a backup of the database, all features metadata and the screenshots already taken.

### Restore backups

* Unzip `db_data.zip` and copy contents to folder db_data.
* Unzip `features.zip` and `screenshots.zip` directly inside behave folder.
* `docker-compose restart`

That's all, easy peasy.

## Access Zalenium Grid

* http://localhost:4444/grid/admin/live

## Access Zalenium Dashboard

* http://localhost:4444/dashboard/

## Access Django

* http://localhost:8000/admin


## Access Postgres Database

```cometa@development:~$ docker exec -it cometa_postgres bash
root@849c522727c1:/# psql -U postgres postgres
psql (12.1 (Debian 12.1-1.pgdg100+1))
Type "help" for help.
postgres=# \c
You are now connected to database "postgres" as user "postgres".

postgres=# \l
                                 List of databases
   Name    |  Owner   | Encoding |  Collate   |   Ctype    |   Access privileges
-----------+----------+----------+------------+------------+-----------------------
 postgres  | postgres | UTF8     | en_US.utf8 | en_US.utf8 |
 template0 | postgres | UTF8     | en_US.utf8 | en_US.utf8 | =c/postgres          +
           |          |          |            |            | postgres=CTc/postgres
 template1 | postgres | UTF8     | en_US.utf8 | en_US.utf8 | =c/postgres          +
           |          |          |            |            | postgres=CTc/postgres
(3 rows)
postgres=# \dt
 public | auth_group                                | table | postgres
 public | auth_group_permissions                    | table | postgres
 public | auth_permission                           | table | postgres
 public | auth_user                                 | table | postgres
 public | auth_user_groups                          | table | postgres
 public | auth_user_user_permissions                | table | postgres
 public | backend_account                           | table | postgres
 public | backend_account_role                      | table | postgres
 public | backend_action                            | table | postgres
 public | backend_application                       | table | postgres
 public | backend_authenticationprovider            | table | postgres
 public | backend_browser                           | table | postgres
 public | backend_cloud                             | table | postgres
 public | backend_department                        | table | postgres
 public | backend_environment                       | table | postgres
 public | backend_environment_allowed_in_department | table | postgres
 public | backend_environmentvariables              | table | postgres
 public | backend_feature                           | table | postgres
 public | backend_feature_result                    | table | postgres
 public | backend_feature_runs                      | table | postgres
 public | backend_feature_runs_feature_results      | table | postgres
 public | backend_feature_task                      | table | postgres
 public | backend_folder                            | table | postgres
 public | backend_folder_feature                    | table | postgres
 public | backend_integration                       | table | postgres
 public | backend_integrationpayload                | table | postgres
 public | backend_invitationtoken                   | table | postgres
 public | backend_invite                            | table | postgres
 public | backend_invite_departments                | table | postgres
 public | backend_miamicontact                      | table | postgres
 public | backend_oidcaccount                       | table | postgres
 public | backend_paymentrequest                    | table | postgres
 public | backend_permissions                       | table | postgres
 public | backend_schedule                          | table | postgres
 public | backend_step                              | table | postgres
 public | backend_step_result                       | table | postgres
 public | backend_stripewebhook                     | table | postgres
 public | backend_subscription                      | table | postgres
 public | backend_token                             | table | postgres
 public | backend_usageinvoice                      | table | postgres
 public | backend_usersubscription                  | table | postgres
 public | command_log_managementcommandlog          | table | postgres
 public | django_admin_log                          | table | postgres
 public | django_content_type                       | table | postgres
 public | django_migrations                         | table | postgres
 public | django_session                            | table | postgres

```


## Directory Layout

 ./: contains globally need files, like docker-compose.yml, docker-ctl.sh and other scripts of global interest.
 ./docker: contains all relevant files need for docker-compose to work properly
 ./src: contains sources files for the cometa project written in python
 ./src/backend: *to be described*
 ./src/cometa_pj: *to be described*

## License

Copyright 2021 COMETA ROCKS S.L.

see [License](/LICENSE) for details