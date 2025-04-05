docker exec -it mongo_database bash -c '
    echo "Waiting for MongoDB to be ready..."
    sleep 5

    echo "Importing admin data..."
    mongoimport --db organization --collection admin --file /tmp/data/admin.json --jsonArray --username root --password rootpassword --authenticationDatabase admin

    echo "Importing HR data..."
    mongoimport --db organization --collection hr --file /tmp/data/hr.json --jsonArray --username root --password rootpassword --authenticationDatabase admin

    echo "Importing employee data..."
    mongoimport --db organization --collection employee --file /tmp/data/employee.json --jsonArray --username root --password rootpassword --authenticationDatabase admin

    echo "Data import completed successfully!"
'