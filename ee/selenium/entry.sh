# #!/bin/bash
chmod +x ./start_recorder.sh
nohup sh -c ./start_recorder.sh & 

cd /opt/bin/ 
./entry_point.sh 

