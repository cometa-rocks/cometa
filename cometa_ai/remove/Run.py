import ollama
from src.utility.common import get_logger

logger = get_logger()



questions = [
        {
            'role': 'computer',
            'images': ['./images/image1.png'],
            'content': '''Which color the car is, only answer color name'''
        },
        {
            'role': 'computer',
            'images': ['./images/image1.png'],
            'prompt': '''Does this image have cars in it? only answer Yes/No'''
        },
        {
            'role': 'user',
            'images': ['./images/image1.png'],
            'prompt': '''Answer only below questions related to this image 
                1. Does this image have cars in it? (Answer Yes/No) 
                2. Which color the car is? (Answer only color)
                3. How many cars do you see in the image (Answer only number)
                '''
        },
        {   
            'role': 'You are an AI model which answer the question in Yes or No, Verify each answer 3 times that it is according to asked question',
            'prompt':"Do not explain, only give me count of cars in the image",
            'images': ['./images/image1.png']
        },
        {   
            'prompt':"Get number of cars and color of those cars",
            'images': ['./images/image1.png']
        }
]

def message_data(data):
        # Open the image in binary mode
    with open(data['images'][0], 'rb') as image_file:
        # Read the image file in binary format
        data['images'][0] = image_file.read()
    
    data['content'] = """    
            Give answer in the JSON format
            keys should has_car and count
            has_car value should be boolean
            count value should be number
            """

    return data

llava_res = ollama.chat(
    model='llava:13b',
    messages=[
        message_data(questions[4]),
        
    ],
    options= {
        "seed": 101,
        "temperature": 0
    } 
)


logger.info("======================================")
logger.info("Image summary message")
logger.info(llava_res["message"]["content"])
logger.info("======================================")

messages = [
    {
          'content':f"""###This my content            
        
            """
    }
]


llama3_res = ollama.chat(
    model='llama3.1',
    messages=[
        {   
          
        }
    ]
)

logger.info("======================================")
logger.info("Question summary")
logger.info(llama3_res["message"]["content"])
logger.info("======================================")