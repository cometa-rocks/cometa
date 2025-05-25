<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/cometa-rocks/cometa_documentation/main/img/logos/COMETAROCKS_LogoEslog_Y_W.png">
  <source media="(prefers-color-scheme: light)" srcset="https://raw.githubusercontent.com/cometa-rocks/cometa_documentation/main/img/logos/COMETAROCKS_LogoEslog_Y_B.png">
  <img alt="Shows a black logo in light color mode and a white one in dark color mode." src="https://user-images.githubusercontent.com/25423296/163456779-a8556205-d0a5-45e2-ac17-42d089e3c3f8.png">
</picture>
<div align="center">
  <h1>Cometa - Complete Meta Test Platform</h1>
  <h4>Codeless & Code-Based Testing Across Systems. Cloud & On-Prem Ready.</h4>

  [![License: AGPL v3](https://img.shields.io/badge/License-AGPL%20v3-blue.svg?style=flat-square)](https://www.gnu.org/licenses/agpl-3.0.html)
  [![GitHub Stars](https://img.shields.io/github/stars/cometa-rocks/cometa?style=social)](https://github.com/cometa-rocks/cometa/stargazers)
  [![Join](https://img.shields.io/discord/810822044367061042?label=Join%20our%20Community&logo=discord)](https://discord.gg/PUxt5bsRej)
  [![YouTube Demo](https://img.shields.io/badge/Watch-Demo-red?logo=youtube&style=flat-square)](https://youtu.be/s86rnmbLDpc)
  [![Twitter Follow](https://img.shields.io/twitter/follow/cometa_rocks?style=social)](https://twitter.com/cometa_rocks)
  [![Contributor Covenant](https://img.shields.io/badge/Contributor%20Covenant-2.1-4baaaa.svg)](CODE_OF_CONDUCT.md)



  <br/>
  <em>Created for DevOps, QA Engineers, SDETs, Developers & Business Teams</em>
</div>

---

## Why Co.Meta?

Co.Meta is an cutting-edge and evolving **open-source meta-test product with enterprise-grade architecture and security**. It has been built with love for DevOps, SDET, and QA engineers, offering both Codeless & Coding approaches.

## One More Thing...
Imagine a world where testing isn't just about finding bugs. It's about creating perfect user experiences, across every system, every time. Where you choose Codeless simplicity or Full-code power — effortlessly. That world is here.

---

## Unmatched Power, Zero Complexity

- **Behavior-Driven by Design**  
  We speak BDD with the Behave framework — tests read like plain English, execute in parallel, and scale infinitely on **Kubernetes**.

- **AI at Your Fingertips**  
  Computer vision meets intelligent agents. Edge-case? Complex scenario? Consider it solved.

- **The Ultimate Testing Functionalities**  
  Accessibility ✔️  
  Automation ✔️  
  Data-Driven ✔️  
  Monitoring ✔️  
  Integration & API ✔️  
  Database ✔️  
  Load Testing ✔️  
  Basic Security ✔️

---

## Effortless Integration

- Seamlessly integrate with your tech stack and deploy without disruption
- Mainframes or enterprise  
- On-prem or cloud  
- Codeless collaboration or Full coding freedom  

No rewrites. No downtime. Just immediate impact.

---

## Built with Passion

| Category | Technologies |
|----------|-------------|
| **Testing Core** | [![Behave](https://img.shields.io/badge/Behave-2.0.0-000000?style=for-the-badge&logo=python&logoColor=white)](https://behave.readthedocs.io/en/stable/) [![Selenium](https://img.shields.io/badge/Selenium-43B02A?style=for-the-badge&logo=selenium&logoColor=white)](https://selenium.dev/) [![Appium](https://img.shields.io/badge/Appium-000000?style=for-the-badge&logo=appium&logoColor=white)](https://appium.io/) |
| **Core Language** | [![Python](https://img.shields.io/badge/Python-3776AB?style=for-the-badge&logo=python&logoColor=white)](https://python.org) |
| **Backend** | [![Django](https://img.shields.io/badge/Django-092E20?style=for-the-badge&logo=django&logoColor=white)](https://www.djangoproject.com/) |
| **Database** | [![PostgreSQL](https://img.shields.io/badge/PostgreSQL-316192?style=for-the-badge&logo=postgresql&logoColor=white)](https://www.postgresql.org/) |
| **AI Engine** | [![Ollama](https://img.shields.io/badge/Ollama-000000?style=for-the-badge&logo=ollama&logoColor=white)](https://ollama.com) |
| **Frontend** | [![Angular](https://img.shields.io/badge/Angular-DD0031?style=for-the-badge&logo=angular&logoColor=white)](https://angular.io/) |

Every line of code, crafted with love.

---

## Editions

- **Community Edition (CE)**  
  Open-source under AGPLv3. Perfect for innovators and enthusiasts.

- **Enterprise Edition (EE)**  
  Advanced features, dedicated support, SLA guarantees. For mission-critical testing at scale.

*You are now looking at the Co.meta Community Edition (CE) licensed under AGPLv3. See [Co.Meta Versions](./VERSIONS.md) for full details.*

---

## Get Started


The easiest way to try out Co.meta is to [join our discord](https://discord.gg/e3uBKHhKW5) and ask for an invitation link. No installation, no credit card required.

The Co.meta installation is straight forward. It uses docker technology and can be run on a Laptop (minimum 16GB RAM, 8 Cores, 28GB diskspace) as well as on a Kubernetes cluster. 

In corporate environments there are some things to know regarding Internet access as well as SSO provider setup. 



## Prerequisites

Here is what you need to be able to run Cometa.

* **Docker and Docker Compose**

  Docker and Docker Compose run seamlessly on both Mac and Windows. Installations have been successfully carried out using Docker Desktop 4.25.2 on macOS 14.1 with Rosetta x86/amd64 emulation. Additionally, running WSL with Ubuntu is a viable option. The choice ultimately depends on your personal preference. Co.meta runs best on Linux, considering that Linux is its native environment. Please use Linux as the operating system. You can explore pre-built  [Virtual Boxes](https://osboxes.org/) for your convenience.
  <br><p>
  Minimum hardware requirements: 16GB RAM, 8 CPUs, 10GB of diskspace.
  <br><p>

* **Internet Connection**

  Co.meta needs to be able to fetch software from the internet. For example python libraries, pre-built containers with virtual browser.

  When installing Co.meta in a corporate environment, make sure to whitelist the following domains on the Secure Proxy:
 

	| **Domain** | **Reason**                                                                                                                                                    |
	|--------------------------------------------------------------|---------------------------------------------------------------------------------------------------------------------------------------------------------------|
	| git.amvara.de                                                | Configure GitLab-runner to provide updates to Cometa. The server should have access to the Amvara GitLab.                                                      |
	| d.amvara.de                                                  | Set up Discord notifications for monitoring Cometa servers (storage, errors, feature executions, etc.) and sending notifications to the Amvara team.           |
	| github.com <br> raw.githubusercontent.com <br> media.githubusercontent.com <br> avatars.githubusercontent.com <br> gist.githubusercontent.com | Cometa downloads dependencies from GitHub repositories, as it is built on open-source libraries.                                                              |
	| docs.docker.com <br> download.docker.com <br> store.docker.com | These URLs are used to download and update Docker and Docker Compose installers when updates are required.                                                     |
	| hub.docker.com                             | Cometa runs on Docker containers and downloads necessary images from Docker Hub, such as Python, Apache, Node.js, etc.                                         |
	| registry.npmjs.org <br> www.npmjs.com <br> deb.nodesource.com | Cometa runs a container called `cometa_socket`, which uses Node.js and npm.                                                                                    |
	| repo.maven.apache.org                      | Cometa runs a container called `cometa_selenoid`, which downloads JAR libraries from Maven.                                                                    |
	| pypi.org                                   | The Cometa components `cometa_behave`, `cometa_django`, and `cometa_scheduler` rely on Python libraries and download dependencies from this URL.              |
	| kubernetes-charts.storage.googleapis.com   | Proxy clearance for accessing Kubernetes charts.                                                                                                              |
	| deb.debian.org  <br> security.debian.org (http and https) | Most of the containers running within cometa uses debian based container, so Debian official repositories are needed for downloading and updating dependencies. |
	| deb-multimedia.org (http and https)                   | Debian multimedia repository for additional multimedia-related packages.                                                    |


  If your corporate environment uses a Secure Proxy, you need to configure Docker to use it:
  
  1. Open the docker config file `nano ~/.docker/config.json`

  2. Add the following:

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
  This configuration ensures, that the Co.meta container use the proxy server, when spinning up virtual browsers. 
  Add any internal Websites, ERPs or Application Endpoints into the above file to be accessible without Proxy.
  <br><p>
  Selenoid Container must be built without above file. So, before rebuilding (e.g. with option --force-recreate) move above to *_bkp (`mv ~/.docker/config.json ~/.docker/config.json_bkp`), then rebuilt selenoid and finally move the file back to original name using `mv ~/.docker/config.json_bkp ~/.docker/config.json`.  
  <br><p>

  Modify /etc/systemd/system/docker.service.d/http_proxy.conf or create the file if missing and add this content:

  ```
  [Service]
  Environment="HTTP_PROXY=http://<host>:<port>/" "NOPROXY=localhost,127.0.0.1,behave,cometa_behave,cometa_django" 
  ```
  
  Then restart the services: `run systemctl daemon-reload` and `systemctl restart docker.service`

  <br><p>

* **ulimit -n 8192**

    Normally a `ulimit -n` of 1024 is sufficient. When using cntlm to divert internal and external traffic in a corporate environment, the ulimit should be set to 8192. Use below command to update ulimit.

	Update ulimit using command
	```ulimit -n 8192```

* **Required disk space**

    Cometa requires approximately ```28GB``` of disk space. Please ensure that your system has a minimum of 28GB of available disk space before installing Cometa. If necessary, consider freeing up space or upgrading your storage capacity.

	To check the available disk space, use the following command
	```df -h . | awk 'NR==2 { print $4 }'```

	To obtain more details on disk space, use the following command
	```df -h .```

* **Server time**

	Your server must be in sync with the global time - consider using [NTP](https://en.wikipedia.org/wiki/Network_Time_Protocol) to keep your local server time synchronized. Time deviation of more than 10 minutes is not supported.

	Why is this important? Because Co.meta supports Single Sign On Providers like oAuth from Gitlab, Github, Azure, Google, Facebook, Ping or others. And the cookie timestamp must be accurate.



## Installation :fire:

Co.meta normally is installed in less then 10 minutes. In case you are stuck for more than 5 minutes - please let us know. And please give us the opportunity to help you. We want to learn how you are using Co.meta and what problems you encounter. We are happy to help.


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


:point_right: **Don't miss this note**: Instead of following the manual setup instructions below, you may execute `./cometa.sh` to bring up a localhost version on your machine.


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

	Co.meta starts on port 443. If that port is used on your machine, change it `docker-compose.yml` to e.g. "8443:443"
	Co.meta also starts on port 80. If that is not available you could change that to 8081 in `docker-compose.yml`

	View some logs `docker-compose logs -f --tail=10` of the installation process, to get a understanding, when Co.meta is ready.

	Give Co.meta some minutes to install python, setup django, download npm and docker files, compile the front end.
	Depending on your computer this can take a couple of minutes.

	You want a development server?

	```sh
	docker-compose -f docker-compose-dev.yml up -d
	```

5. **(Optional)** Create superuser for the Backend Admin

	Default superuser is created at runtime as `admin:admin`.

	```
	bash
	docker exec -it cometa_django bash
	root@cometa_django:/opt/code# python manage.py createsuperuser
	``` 

6. **(Optional)** Install latest browser versions

	`./backend/selenoid/deploy_selenoid.sh -n 3`.

	This will configure and pull the three newest Docker images with virtual browsers.

	Selenoid image are the browser that you will be able use and select in Co.meta. 

	Of course there are options to include browserstack, headspin or sourcelabs browsers. But that is a bit you would not want to configure on your first setup.

	This step will take some time as all the default browser images are being pulled.

	Once Co.meta is up and running, you can parse the new browser images available into Co.meta by calling `https://localhost/backend/parseBrowsers/`

7. See Co.meta in your browser

	Test server access `curl -k  https://<yourdomain>:<specified port - default 443>/`

	Example `curl -k  https://localhost:443/`

	You should see something like this:
	<p>The document has moved <i>here</i>.</p>

8. Import the over 70 pre-defined actions

	On first start you have to manually parse the actions.py file. This enables cometa to use any steps defined in the UI. The user can then choose from the steps in the UI.
	`https://localhost/backend/parseActions/` ... as a result cometa will show all actions that have been parsed and are now available for selection in cometa-front.

	Import option is also available in the Admin Section of Co.meta.


9. Run your first test

	Click on the "+" on the very top. Select Department, Environment and Feature Name

	Please delete or disable the first step shown as an example and import this JSON to search for "Cometa Rocks" on google

   ```[{"enabled":true,"screenshot":true,"step_keyword":"Given","compare":false,"step_content":"Goto URL \"https://www.google.de/\"","step_type":"normal","continue_on_failure":false,"timeout":60},{"enabled":true,"screenshot":false,"step_keyword":"Given","compare":false,"step_content":"Maximize the browser","step_type":"normal","continue_on_failure":false,"timeout":60},{"enabled":true,"screenshot":true,"step_keyword":"Given","compare":false,"step_content":"wait until I can see \"google\" on page","step_type":"normal","continue_on_failure":false,"timeout":60},{"enabled":true,"screenshot":true,"step_keyword":"Given","compare":false,"step_content":"I move mouse to \"//button[2]\" and click","step_type":"normal","continue_on_failure":true,"timeout":5},{"enabled":true,"screenshot":true,"step_keyword":"Given","compare":false,"step_content":"I move mouse to \"//textarea\" and click","step_type":"normal","continue_on_failure":false,"timeout":60},{"enabled":true,"screenshot":true,"step_keyword":"Given","compare":false,"step_content":"Send keys \"cometa rocks\"","step_type":"normal","continue_on_failure":false,"timeout":60},{"enabled":true,"screenshot":true,"step_keyword":"Given","compare":false,"step_content":"Press Enter","step_type":"normal","continue_on_failure":false,"timeout":60},{"enabled":true,"screenshot":true,"step_keyword":"Given","compare":false,"step_content":"wait until I can see \"cometa rocks\" on page","step_type":"normal","continue_on_failure":false,"timeout":60},{"enabled":true,"screenshot":true,"step_keyword":"Given","compare":true,"step_content":"I sleep \"1\" seconds","step_type":"normal","continue_on_failure":false,"timeout":6}]```


#### Notes

* Final Co.meta is available at `https://localhost/`
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

## 📂 Directory Layout
```
./behave                # Behave related files
./crontabs              # contains crontab files for Django & Behave
./selenoid              # Selenoid related files
./front                 # Apache and Angular files
./src                   # Django related files
./src/backend           # contains the Backend code for URLs
./src/cometa_pj         # contains the configuration of Django
./ws-server             # WebSocket server related files
```

## Support

See [Documentation](https://github.com/cometa-rocks/cometa_documentation) for in depth explanations how to use Co.meta.

Happy to see your e-Mail help - at - cometa.rocks.

Preferable open an issue: https://github.com/cometa-rocks/cometa/issues  


# Investing

[![YouTube video](https://img.youtube.com/vi/vbgcb9R-ewI/maxresdefault.jpg)](https://www.youtube.com/watch?v=vbgcb9R-ewI)

Happy to explore further collaboration: the thumbnail will redirect you to a quick YouTube video


# License

Copyright 2025 COMETA ROCKS S.L.

Portions of this software are licensed as follows:

* All content that resides under "ee/" directory of this repository (Enterprise Edition) is licensed under the license defined in "ee/LICENSE". (Work in progress)
* All third party components incorporated into the Co.meta Software are licensed under the original license provided by the owner of the applicable component.
* Content outside of the above mentioned directories or restrictions above is available under the "AGPLv3" license as defined in `LICENSE` file.

## 🛠️ Tech Stack

<div align="center">

### Core Technologies
[![Python](https://img.shields.io/badge/Python-3776AB?style=for-the-badge&logo=python&logoColor=white)](https://python.org)
[![Selenium](https://img.shields.io/badge/Selenium-43B02A?style=for-the-badge&logo=selenium&logoColor=white)](https://selenium.dev/)
[![Appium](https://img.shields.io/badge/Appium-000000?style=for-the-badge&logo=appium&logoColor=white)](https://appium.io/)
[![Playwright](https://img.shields.io/badge/Playwright-2EAD33?style=for-the-badge&logo=playwright&logoColor=white)](https://playwright.dev/)

### Supporting Technologies
[![Behave](https://img.shields.io/badge/Behave-2.0.0-000000?style=for-the-badge&logo=python&logoColor=white)](https://behave.readthedocs.io/en/stable/)
[![Ollama](https://img.shields.io/badge/Ollama-000000?style=for-the-badge&logo=ollama&logoColor=white)](https://ollama.com)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-316192?style=for-the-badge&logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![Django](https://img.shields.io/badge/Django-092E20?style=for-the-badge&logo=django&logoColor=white)](https://www.djangoproject.com/)
[![Angular](https://img.shields.io/badge/Angular-DD0031?style=for-the-badge&logo=angular&logoColor=white)](https://angular.io/)

</div>
