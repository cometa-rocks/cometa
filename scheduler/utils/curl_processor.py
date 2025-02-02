import re

def parse_curl_command(curl_command):
    # Regex to extract URL, HTTP method, and data
    url_pattern = re.compile(r'-X\s+(\w+)\s+(\S+)')
    data_pattern = re.compile(r"--data\s+'(\{.*?\})'")
    header_pattern = re.compile(r'-H\s+"([^"]+)"')

    # Find method and URL
    method_url_match = url_pattern.search(curl_command)
    method, url = method_url_match.groups() if method_url_match else ("", "")

    # Find data
    data_match = data_pattern.search(curl_command)
    data = data_match.group(1) if data_match else ""

    # Find all headers
    headers = header_pattern.findall(curl_command)

    # Convert headers into a dictionary
    header_dict = {h.split(': ')[0]: h.split(': ')[1] for h in headers}

    return {
        "method": method,
        "url": url,
        "data": data,
        "headers": header_dict
    }