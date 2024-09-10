# /bin/bash

# To pull models of ollama, ollama server has to be running in an terminal
nohup ollama serve &

# Pull the models 7b by default
ollama pull llava
ollama pull llama3.1
# ollama pull llava:13b

# https://ollama.com/library/llava:13b
# https://ollama.com/library/llava



