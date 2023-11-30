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

### In depth guide on how to proper set up GitLab as an authentication provider  

If you've never set up GitLab as an authentication provider before or you prefer following a step by step guide, please consider following this guide.

To correctly set up GitLab as your authentication provider please follow the next steps:

* Go to [git.amvara.de](https://git.amvara.de/)
* Create a new account
* On the top left corner of you screen you will find your profile picture. Acess the `Preferences` menu by clicking there
* Accessing `Preferences` will display the `User settings`, where you can access to the `Applications` menu and add a new one

* Give a name to the new application and set `redirect_uri` to `https://<domain>/callback` 

The default URL when installing on you Desktop or Laptop, is `localhost`.

* Configure the necessary scopes (openid, profile, email at minimum) and save the application

If done correctly, you'll be redirected to a new page showing all the application information such as your `client_id` and `secret_id`.

* Retrieve the `client_id` and `secret_id` and paste them in `./front/apache-conf/metadata/accounts/git.amvara.de.client`

Congratulations! If you arrived here means you've correctly set up your GitLab authentication.

Now you can continue with the installation of Cometa. Please don't forget after this point you may execute `./cometa.sh` to bring up a localhost version on your machine.
