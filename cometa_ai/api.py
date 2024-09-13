import requests
import json
import base64
# refered document
# https://github.com/ollama/ollama/blob/main/docs/api.md#generate-a-chat-completion

# URL of the API endpoint
url = "http://localhost:11434/api/chat"


def image_data(path):
    image_value = ""
        # Open the image in binary mode
    with open(path, 'rb') as image_file:
        # Read the image file in binary format
        encoded_image = base64.b64encode(image_file.read()).decode('utf-8')
        
    return encoded_image

messages = [
        {
            "role": "user",
            "content": "Explain everything that you see about the cars",
            "images": [image_data('./images/image1.png')]
        }
    ]

# Data payload
payload = {
    "model": "llava:latest",
    "messages": messages,
    "stream": False
}

# Headers for the request
headers = {
    "Content-Type": "application/json"
}

# Make the POST request
response = requests.post(url, data=json.dumps(payload), headers=headers)

response_body = response.json()

# Print the response
print(f"Status Code: {response.status_code}")
print(f"Response: {response_body['message']}")


messages.append(response_body['message'])


messages.append({
    'role': 'user', 
    'content': """
    ## Base on above answer give me answer only in the JSON format
        keys should be has_car and count
        has_car value should be boolean
        count value should be a number
    """
    })

# Data payload
payload = {
    "model": "llama3.1",
    "messages": messages,
    "stream": False
}

# Make the POST request
response = requests.post(url, data=json.dumps(payload), headers=headers)

response_body = response.json()

# Print the response
print(f"Status Code: {response.status_code}")
print(f"Response: {response_body['message']}")

