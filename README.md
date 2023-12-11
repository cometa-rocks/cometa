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

* **Docker and Docker Compose**

  Docker and Docker Compose run seamlessly on both Mac and Windows. Installations have been successfully carried out using Docker Desktop 4.25.2 on macOS 14.1 with Rosetta x86/amd64 emulation. Additionally, running WSL with Ubuntu is a viable option. The choice ultimately depends on your personal preference. We recommend running Co.meta on Linux, considering that Linux is its native environment. Please use Linux as the operating system. You can explore pre-built  [Virtual Boxes](https://osboxes.org/) for your convenience.
  <br><p>

* **Internet Connection**

  Co.Meta needs to be able to fetch software from the internet. For example python libraries, pre-built containers with virtual browser.

  When installing Co.meta in a corporate environment, make sure to whitelist the following domains on the Secure Proxy:

  * https://*.amvara.de
  * https://github.com
  * https://*.githubusercontent.com
  * https://*.docker.com
  * https://*.docker.io
  * https://registry.npmjs.org
  * https://www.npmjs.com
  * https://repo.maven.apache.org
  * https://kubernetes-charts.storage.googleapis.com
  * https://plugins.gradle.org:443
  * https://registry.yarnpkg.com
  * https://deb.nodesource.com
  * https://mod-auth-openidc.org
  * https://pypi.org
  <br><p>

  For corporate environments using a Secure Proxy the Proxy Usage needs to be configured:
  Edit the following `nano ~/.docker/config.json`

  <br>
  Add the following:

  ```
  {
	"proxies":
	{
		"default":
			{
				"httpProxy": "http://<host>:<port>",
				"httpsProxy": "http://<host>:<port>",
				"noProxy": "localhost,127.0.0.1,172.0.0.1/8,cometa_socket,cometa_zalenium,cometa_front,cometa_behave,cometa_django,cometa_postgres,behave" 
			}
		}
  }
  ```
  This configuration ensures, that the Co.Meta container use the proxy server, when spinning up virtual browsers. 
  Add any internal Websites, ERPs or Application Endpoints into the above file to be accessible without Proxy. 
  <br><p>

  Modify /etc/systemd/system/docker.service.d/http_proxy.conf or create the file if missing and add this content:

  ```
  [Service]
  Environment="HTTP_PROXY=http://<host>:<port>/" "NOPROXY=localhost,127.0.0.1,behave,cometa_behave,cometa_django" 
  ```
  
  Then restart the services: `run systemctl daemon-reload` and `systemctl restart docker.service`

  <br><p>


* **Server time**

	Your server must be in sync with the global time - consider using [NTP](https://en.wikipedia.org/wiki/Network_Time_Protocol) to keep your local server time syncronised. Time deviation of more than 10 minutes is not supported.

	Why is this important? Because Co.Meta supports Single Sign On Providers like oAuth from Gitlab, Github, Azure, Google, Facebook, Ping or others. And the cookie timestamp must be accurate.

In case you are stuck for more than 5 minutes - please let us know. And please give us the opportunity to help you. We want to learn how you are using Co.Meta and what problems you encounter. <a href="https://cometa.rocks/support/">Contact us</a>. We are happy to help.


#### Installation

1. Clone the repo
	```sh
   git clone https://github.com/cometa-rocks/cometa.git
   ```

2. Setup at least 1 authentication provider:

	To setup Google (for a more in detail guide [click here](./docs/GoogleAuthentication.md) ):
	* Go to [Google Developer Console](https://console.cloud.google.com/)
	* Create an OAuth application
	* Add your domain to the allowed hosts
	* Retrieve the `client_id` and `secret_id` and paste them in `./front/apache-conf/metadata/accounts.google.com.client`

	* Set `redirect_uri` to `https://<domain>/callback` on your project's credential page 

	* For further information please refer to [Google Cloud Platform Console Help](https://support.google.com/cloud/answer/6158849?hl=en#zippy=)

	To setup Gitlab (for a more in detail guide [click here](./docs/GitAuthentication.md) ):
	* Go to [git.amvara.de](https://git.amvara.de/)
	* Create a new account
	* Settings > Application > Add new application
	* Add your domain to the allowed hosts
	* Retrieve the `client_id` and `secret_id` and paste them in `./front/apache-conf/metadata/accounts/git.amvara.de.client`

	* Set `redirect_uri` to `https://<domain>/callback`

	In both cases, the default URL when installing on you Desktop or Laptop, is `localhost`.


**Don't miss this note**: Instead of following the manual setup instructions below, you may execute `./cometa.sh` to bring up a localhost version on your machine.


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

	Co.Meta starts on port 443. If that port is used on your machine, change it `docker-compose.yml` to e.g. "8443:443"
	Co.Meta also starts on port 80. If that is not available you could change that to 8081 in `docker-compose.yml`

	View some logs `docker-compose logs -f --tail=10` of the installation process, to get a understanding, when Co.Meta is ready.

	Give Co.Meta some minutes to install python, setup django, download npm and docker files, compile the front end.
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

	Selenoid image are the browser that you will be able use and select in Co.Meta. 

	Of course there are options to include browserstack, headspin or sourcelabs browsers. But that is a bit you would not want to configure on your first setup.

	This step will take some time as all the default browser images are being pulled.

	Once Co.Meta is up and running, you can parse the new browser images avaible into Co.Meta by calling `https://localhost/backend/parseBrowsers/`

7. See Co.Meta in your browser

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

* Final Co.Meta is available at `https://localhost/`
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

* All content that resides under "ee/" directory of this repository (Enterprise Edition) is licensed under the license defined in "ee/LICENSE". (Work in progress)
* All third party components incorporated into the Co.Meta Software are licensed under the original license provided by the owner of the applicable component.
* Content outside of the above mentioned directories or restrictions above is available under the "AGPLv3" license as defined in `LICENSE` file.
