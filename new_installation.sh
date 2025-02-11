sudo mkdir -p ./data/front
sudo mkdir -p ./data/django

if [ ! -f "./data/front/apache2" ]; then
    sudo cp ./front/apache2 ./data/front/
fi

if [ ! -f "./data/django/migrations" ]; then
    sudo cp ./backend/src/migrations ./data/django/
fi

