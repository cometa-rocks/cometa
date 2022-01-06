echo "* Calling \"docker exec -it cometa_django python3 manage.py migrate\" to applay django migrations"
docker exec -it cometa_django python3 manage.py makemigrations
docker exec -it cometa_django python3 manage.py migrate
echo "* Migration done"