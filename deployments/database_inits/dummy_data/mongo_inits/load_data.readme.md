docker exec -it mongo_database bash 
cd /tmp/data

mongoimport --db organization --collection admin --file admin.json --jsonArray --username root --password rootpassword --authenticationDatabase admin
mongoimport --db organization --collection hr --file hr.json --jsonArray --username root --password rootpassword --authenticationDatabase admin
mongoimport --db organization --collection employee --file employee.json --jsonArray --username root --password rootpassword --authenticationDatabase admin

