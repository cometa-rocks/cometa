
# Front Deployment

## Add new authentication provider configuration with in /share/front/apache-conf/metadata

create metadata files using command below commands, change name according to your domain

```cd /share/apache-conf/metadata```

```touch gitlab.com.client gitlab.com.conf gitlab.com.provider```

#### gitlab.com.client
- Add client_id and client_secret
<pre>
    {
        "client_id" : "",
        "client_secret" : "",
        "response_type" : "id_token"
    }
</pre>

#### gitlab.com.conf
- Insert `{}` in gitlab.com.conf

- ```echo {} > gitlab.com.conf```

#### gitlab.com.provider
- hit url: https://gitlab.com/.well-known/openid-configuration in the browser and paste the json content to file gitlab.com.provider 



## Load data with new authentication provider [Kubernetes]

update your authentication_provider.json

```vi authentication_provider.json```

```python manage.py loaddata /opt/code/defaults/authentication_provider.json```

Delete front pod, the new pod will copy file from share to apache directory

Access the Cometa url https://localhost/ or https://your_cometa_url in the browser


## Once the front is up and running

#### Update Step actions  
> https://localhost/backend/parseActions/

#### Update browsers 
> https://localhost/backend/parseBrowsers/


#### Create admin User
> ```python manage.py createsuperuser```

> Enter username and password save in the ticket

# Selenium Grid Helm chart

    https://github.com/SeleniumHQ/docker-selenium/tree/trunk/charts/selenium-grid

    minikube addons enable storage-provisioner-gluster

    helm repo add docker-selenium https://www.selenium.dev/docker-selenium

    helm repo update

    helm upgrade --install selenium-grid docker-selenium/selenium-grid -n cometa --values values-selenium-grid-helm.yaml

    For testing purpose - use below command
    kubectl port-forward --address 88.198.116.6 service/selenium-grid-selenium-hub 4444:4444 -n cometa

    helm uninstall selenium-grid -n cometa

### Remove unnecessary browsers by login to backend/admin
### Update the browser version


### update selenium grid url to backend/admin/cloud

- url should be http://admin:admin@selenium-grid-selenium-hub:4444


### Create test

    [{"enabled":true,"screenshot":false,"step_keyword":"Given","compare":false,"step_content":"StartBrowser and call URL \"https://google.com/\"","step_type":"normal","continue_on_failure":false,"timeout":60},{"enabled":false,"screenshot":false,"step_keyword":"Given","compare":false,"step_content":"I move mouse to \"//button[2]\" and click","step_type":"normal","continue_on_failure":false,"timeout":60},{"enabled":true,"screenshot":true,"step_keyword":"Given","compare":false,"step_content":"I move mouse to \"//textarea\" and click","step_type":"normal","continue_on_failure":false,"timeout":60},{"enabled":true,"screenshot":true,"step_keyword":"Given","compare":false,"step_content":"Send keys \"$search\"","step_type":"normal","continue_on_failure":false,"timeout":60}]

### Check below options are working
- Video recording
- Screen shots
- Test Scheduling

- Configure Email