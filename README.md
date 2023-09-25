
<!-- PROJECT LOGO -->

<p  align="center">
<h1  align="center">Cometa</h1>
<p  align="center">
Open source is the future. Co.Meta is an advanced & evolving meta-test product that has been made with ❤️ for DevOps and QA Engineers. <a  href="https://cometa.rocks/"><strong>Learn more</strong></a>
<br>
<br>
<a  href="https://cometa.rocks/support/">Support</a>

</p>

</p>

[![YouTube video](https://img.youtube.com/vi/vbgcb9R-ewI/maxresdefault.jpg)](https://www.youtube.com/watch?v=vbgcb9R-ewI)
(Clicking the thumbnail will redirect you to a quick YouTube video)

### Built With

- [Angular](https://angular.io/)
- [Django](https://www.djangoproject.com/)
- [Behave](https://behave.readthedocs.io/en/stable/)
- [Selenoid](https://aerokube.com/selenoid/)
- [PostgreSQL](https://www.postgresql.org/)

## Getting started

### Prerequisites

Here is what you need to be able to run Cometa.

- Docker
- Docker Compose
- Use Linux as operating system. Have a look at pre-build [Virtual Boxes](https://osboxes.org/)

In any case that you are stuck for more than 5 minutes - please us know. And please give us the oportunity to help you. We want to learn how you are using cometa and what problems you encounter. <a href="https://cometa.rocks/support/">Contact us</a>. We are happy to help.

#### Manual

1. Clone the repo
	```sh
   git clone https://github.com/cometa-rocks/cometa.git
   ```

2. Setup at least 1 authentication provider:

	To setup Google:
	* Go to [Google Developer Console](https://console.cloud.google.com/)
	* Create an OAuth application
	* Add your domain to the allowed hosts
	* Retrieve the `client_id` and `secret_id` and paste them in `./front/apache-conf/metadata/accounts.google.com.client`

	* Set `redirect_uri` to `https://<domain>/callback`

	To setup Gitlab:
	* Goto [git.amvara.de](https://git.amvara.de/)
	* Create a new account
	* Settings > Application > Add new application
	* Add your domain to the allowed hosts
	* Retrieve the `client_id` and `secret_id` and paste them in `./front/apache-conf/metadata/accounts/git.amvara.de.client`

	* Set `redirect_uri` to `https://<domain>/callback`

	In both cases, the default URL when installing on you Desktop or Laptop, is `localhost`.


Very nice: Instead of following the manual setup instructions below, you may execute `./cometa.sh` to bring up a localhost version on your machine.


3. Create a crontab file for scheduling your automated tests

   ```sh
   mkdir -p backend/behave/schedules && touch backend/behave/schedules/crontab
   ```

4. Get all Docker containers up:

	In `docker-compose.yml` change <server> to 'local' and <server-outside-port> to '80' or according to your needs.

	* Change the `<outside_port>` port to `80` or any other port you'd like. Keep in mind that this port should match with what is configured inside the `openidc.conf`
	* Change the `<server>` to `local` or your custom configuration file in `front/apache-conf/openidc.conf_<custom_name>`



	```sh
	docker-compose up -d && docker-compose logs -f --tail=10
	```

	Cometa starts on port 443. If that port is used on your machine, change it `docker-compose.yml` to e.g. "8443:443"
	Cometa also starts on port 80. If that is not available you could change that to 8081 ind `docker-compose.yml`

	View some logs `docker-compose logs -f --tail=10` of the installation process, to get a understanding, when cometa is ready.

	Give cometa some minutes to install python, setup django, download npm and docker files, compile the front end.
	Depending on your computer this can take a couple of minutes.

	You want a development server?

	```sh
	docker-compose -f docker-compose-dev.yml up -d
	```

5. **(Optional)** Create superuser for the Backend Admin

	Default superuser is created on runtime as `admin:admin`.

	```
	bash
	docker exec -it cometa_django bash
	root@cometa_django:/opt/code# python manage.py createsuperuser
	``` 

6. **(Optional)** Install latest browser versions

	`./backend/selenoid/deploy_selenoid.sh -n 3`.

	This will configure and pull the three newest Docker images with virtual browsers for Selenoid.

	Selenoid image are the browser that you will be able use and select in cometa. 

	Of course there are options to include browserstack, headspin or sourcelabs browsers. But that is a bit you would not want to configure on your first setup.

	This step will take some time as all the default browser images are being pulled.

	Once cometa is up and running, you can parse the new browser images avaible into Cometa by calling `https://localhost/backend/parseBrowsers/`

7. See cometa rocks in your browser

	Test server access `curl -k  https://<yourdomain>:<specified port - default 443>/`

	Example `curl -k  https://localhost:443/`

	You should see something like this:
	<p>The document has moved <i>here</i>.</p>

8. Import the over 70 pre-defined actions

	On first start you have to manually parse the actions.py file. This enables cometa to use any steps defined in the UI. The user can then choose from the steps in the UI.
	`https://localhost/backend/parseActions/` ... as a result cometa will show all actions that have been parsed and are now available for selection in cometa-front.


8. Run your first test

	Click on the "+" on the very top. Select Department, Environment and Feature Name

	And import this JSON to search for "cometa Rocks" on google

	```[{"enabled":true,"screenshot":true,"step_keyword":"Given","compare":false,"step_content":"Goto URL \"https://www.google.de/\"","step_type":"normal","continue_on_failure":false,"timeout":60},{"enabled":true,"screenshot":false,"step_keyword":"Given","compare":false,"step_content":"Maximize the browser","step_type":"normal","continue_on_failure":false,"timeout":60},{"enabled":true,"screenshot":true,"step_keyword":"Given","compare":false,"step_content":"wait until I can see \"google\" on page","step_type":"normal","continue_on_failure":false,"timeout":60},{"enabled":true,"screenshot":true,"step_keyword":"Given","compare":false,"step_content":"I move mouse to \"//button[2]\" and click","step_type":"normal","continue_on_failure":true,"timeout":5},{"enabled":true,"screenshot":true,"step_keyword":"Given","compare":false,"step_content":"I move mouse to \"//input\" and click","step_type":"normal","continue_on_failure":false,"timeout":60},{"enabled":true,"screenshot":true,"step_keyword":"Given","compare":false,"step_content":"Send keys \"cometa rocks\"","step_type":"normal","continue_on_failure":false,"timeout":60},{"enabled":true,"screenshot":true,"step_keyword":"Given","compare":false,"step_content":"Press Enter","step_type":"normal","continue_on_failure":false,"timeout":60},{"enabled":true,"screenshot":true,"step_keyword":"Given","compare":false,"step_content":"wait until I can see \"cometa rocks\" on page","step_type":"normal","continue_on_failure":false,"timeout":60},{"enabled":true,"screenshot":true,"step_keyword":"Given","compare":true,"step_content":"I sleep \"1\" seconds","step_type":"normal","continue_on_failure":false,"timeout":60}]```


#### Notes

* Final Cometa is available at `https://localhost/`
* To enable Debug mode on front:
	```bash
	docker exec -it cometa_front bash
	root@cometa_front:/code# ./start.sh serve
	```
	 Front Debug mode will available at `https://localhost/debug/`

## Backups

To create a backup simply execute `./backup.sh` on the root folder (make sure it has `+x` permission).

A folder will be created inside backups with the date of the backup, this folder includes a backup of the database, all features metadata and the screenshots already taken.

### Restore backups

1. Unzip `db_data.zip` and copy contents to folder db_data.
2. Unzip `features.zip` and `screenshots.zip` directly inside behave folder.
3. `docker-compose restart`

That's all, easy peasy.

## Backend resources

* Selenoid Grid: http://localhost:4444/wd/hub
* Selenoid Dashboard: http://localhost:4444/dashboard/
* Django: http://localhost:8000/admin

## Directory Layout

* `./behave` Behave related files
* `./crontabs` contains crontab files for Django & Behave
* `./selenoid` Selenoid related files
* `./front` Apache and Angular files
* `./src` Django related files
* `./src/backend` contains the Backend code for URLs
* `./src/cometa_pj:` contains the configuration of Django
* `./ws-server` WebSocket server related files

## License

Copyright 2022 COMETA ROCKS S.L.

Portions of this software are licensed as follows:

* All content that resides under "ee/" directory of this repository (Enterprise Edition) is licensed under the license defined in "ee/LICENSE". (Work in porgress)
* All third party components incorporated into the cometa.rocks Software are licensed under the original license provided by the owner of the applicable component.
* Content outside of the above mentioned directories or restrictions above is available under the "AGPLv3" license as defined in `LICENSE` file.
