# Few trouble shoots steps 

### Build container using 
```docker-compose -f docker-compose_ai.yml up --build ollama.ai```

### In case of below error
<pre>
cometa.ollama.ai  |   File "/usr/local/lib/python3.11/site-packages/redis/connection.py", line 1074, in get_connection
cometa.ollama.ai  |     connection.connect()
cometa.ollama.ai  |   File "/usr/local/lib/python3.11/site-packages/redis/connection.py", line 283, in connect
cometa.ollama.ai  |     raise ConnectionError(self._error_message(e))
cometa.ollama.ai  | redis.exceptions.ConnectionError: Error 13 connecting to cometa.redis.ai:6379. Permission denied.
</pre>

**Run** 

```chmod -R ugo+r ./data/redis/```