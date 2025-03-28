from dotenv import load_dotenv
from langchain_openai import ChatOpenAI
from browser_use import Agent
import asyncio

OPENAI_API_KEY = "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"

load_dotenv()

import logging
logging.getLogger("browser_use").setLevel(logging.DEBUG)

# Initialize the model
llm = ChatOpenAI(
    model='gpt-4o',
    temperature=0.0,
    openai_api_key=OPENAI_API_KEY
)

# Define sensitive data
# The model will only see the keys (x_name, x_password) but never the actual values
sensitive_data = {'x_name': 'magnus', 'x_password': '12345678'}

# Use the placeholder names in your task description
task = 'go to x.com and login with x_name and x_password then write a post about the meaning of life'

# Pass the sensitive data to the agent
agent = Agent(task=task, 
              llm=llm,
              sensitive_data=sensitive_data,
              save_conversation_path="logs/conversation" 
              )

async def main():   
    history = await agent.run(max_steps=2)

    # Check for errors
    print(history.errors())

    # Review the agent's thoughts and actions
    print(history.model_thoughts())
    print(history.model_actions())

if __name__ == '__main__':
    asyncio.run(main())