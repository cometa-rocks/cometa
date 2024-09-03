import ollama
from src.utility.common import get_logger
from src.utility.exception_handler import error_handling
from src.utility.system import find_and_kill_proc_using_fd
logger = get_logger()

MODEL_NAME = "llava"

error_handling()


def analyze_image(data):
    # Simulate image analysis (this is where your actual processing logic will be)
    prompt = data.get("prompt", None)
    images_path = data.get("images", None)

    if prompt != None and data != None:
        logger.info(f'Analyzing images {images_path} with prompt : "{prompt}"')
        res = ollama.chat(
            model=MODEL_NAME,
            messages=[{"role": "user", "prompt": prompt, "images": images_path}],
        )
        
        # Return the result, which will be stored by rq
        return {"answer": res["message"]["content"]}

    else:
        return {
            "answer": {
                "message": "Invalid data found for image analysis",
                "required": {"images": ["path"], "prompt": "xyz" },
            }
        }


