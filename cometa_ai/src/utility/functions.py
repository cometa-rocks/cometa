import base64


def image_decoded(path):
    try:
            # Open the image in binary mode
        with open(path, 'rb') as image_file:
            # Read the image file in binary format
            encoded_image = base64.b64encode(image_file.read()).decode('utf-8')
            
        return encoded_image
    except Exception as exception:
        return str(exception)