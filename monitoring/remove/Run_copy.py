import ollama

import base64

def image_data(path):
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

llava_res = ollama.chat(
    model='llava',
    messages=messages,
    options= {
        "seed": 101,
        "temperature": 0
    } 
)

print("\n######################################")
print("Image summary message",end="->")
print(llava_res["message"]["content"])
print("######################################\n")


messages.append(llava_res["message"])


messages.append({
    'role': 'user', 
    'content': """
    ## Base on above answer give me answer only in the JSON format
        keys should be has_car and count
        has_car value should be boolean
        count value should be a number
    """
    })


llama3_res = ollama.chat(
    model='llama3.1',
    messages=messages,
    options= {
        "seed": 101,
        "temperature": 0
    } 
)

print("\n######################################")
print("Question summary")
print(llama3_res["message"]["content"])
print("######################################\n")

