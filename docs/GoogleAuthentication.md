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

### In depth guide on how to proper set up OAuth 

If you've never worked with the [Google Developer Console](https://console.cloud.google.com/) before, or you prefer following a step by step guide on how to set Google as your authentication provider, please consider following this guide.

To correctly set up Google as your authentication provider please follow the next steps:

* Go to [Google Developer Console](https://console.cloud.google.com/)
    * Log in, click on `Select a project` and start a new project 
    * Name and create your project
    * Once created, open it and find on your top left corner the navigation menu. Access the `Credentials` menu you can find on `APIs   and services`

    * Before creating any credentials you need to configure first the `OAuth consent screen` by properly filling the `App information` and `Developer contact information` sections at minimum

    * Once here, you can create an `OAuth client ID` on the `Credentials` menu:
        * Create the `OAuth client ID`
        * Select an `Application type` and name it
        * Set `redirect_uri` to `https://<domain>/callback`
        
        The default URL when installing on you Desktop or Laptop, is `localhost`.
    
    * Retrieve the `client_id` and `secret_id` and paste them in `./front/apache-conf/metadata/accounts/accounts.google.com.client`

Congratulations! If you arrived here means you've correctly set up your `OAuth Client ID`.

Now you can continue with the installation of Cometa. Please don't forget after this point you may execute `./cometa.sh` to bring up a localhost version on your machine.
    

