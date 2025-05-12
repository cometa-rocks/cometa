#/bin/bash

alias rdfa="docker exec -it cometa_front httpd -k restart"
alias ldfa="docker logs cometa_front"
alias crfa="docker compose -it cometa_front httpd -k restart"
alias crf="docker compose -it cometa_front httpd -k restart"
alias cdev="docker compose -it cometa_front httpd -k restart"
alias cif="docker inspect cometa_front"
alias cid="docker inspect cometa_django"
alias cib="docker inspect cometa_behave"
alias cis="docker inspect cometa_socket"

--init-front-conf
    rm {DATA_DIR}