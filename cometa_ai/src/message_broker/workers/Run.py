import ollama

res = ollama.chat(
    model='llava',
    messages=[
        {
            'role': 'user',
            'content': '''Answer below questions related to this image 
                1. Does this image have cars in it? (Answer Yes/No) 
                2. Which color the car is? (Answer only color)
                3. How many cars do you see in the image (Answer only number)
                
                Please, 
                1. Verify you answer 2 times and then provide the answer to each question
                2. If there are more than 1 car provide colors of all cars 
                ''',
            'images': ['./images/image1.png']
        }
    ]
)

print()