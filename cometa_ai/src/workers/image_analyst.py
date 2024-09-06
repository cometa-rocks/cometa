import ollama
from src.utility.common import get_logger
from src.utility.exception_handler import error_handling
from src.utility.system import find_and_kill_proc_using_fd
from src.utility.functions import image_decoded
logger = get_logger()

IMAGE_ANALYZER_MODEL_NAME = "llava"
LLAMA_MODEL_NAME = "llama3.1"

# image_analysis_data should contain information in the form of 
# image_analysis_data = [
#     {
#         "content": "Explain everything that you see about the cars",
#         "images": ["images_decoded"] 
#     },
#     {
#         "content": """ ## Base on above answer give me answer only in the JSON format
#             # keys should be has_car and count
#             # has_car value should be boolean
#             # count value should be a number""",
#         "images": ["images_decoded"] 
#     }
# ]
#

def analyze_image(messages):
    # Simulate image analysis (this is where your actual processing logic will be)
    
    if len(messages)==0:
         return {
            "answer": {
                "message": "Invalid data found for image analysis, 'image_analysis_data' should be list with atleast one record the below format",
                "image_analysis_data": [{"images": ["images_decoded_data"], "content": "what ever you want to analyze" }],
            }
        }
    
    # Keep record of user and assistent messages to continue to do a chain of chatting
    user_and_assistent_messages = []
    
    for analysis_data in messages:
        user_message = {'role': 'user'}
        user_message.update(analysis_data)
        # Add user messages in the user_and_assistent_messages
        user_and_assistent_messages.append(user_message)
        # If analysis_data data from user contains 'images' the use IMAGE_ANALYZER_MODEL_NAME other use LLAMA model which is used for text processing
        model = IMAGE_ANALYZER_MODEL_NAME if analysis_data.get('images',False) else LLAMA_MODEL_NAME   
        # Do a chat with ollama
        llava_res = ollama.chat(
            model=model,
            messages=user_and_assistent_messages,
            options= {
                "seed": 101,
                "temperature": 0
            } 
        )
        # Add assistent response message in the user_and_assistent_messages to keep track of discssuion
        user_and_assistent_messages.append(llava_res["message"])

    # return last index value, which is a last response from the assistent
    return user_and_assistent_messages[-1]['content']
        


