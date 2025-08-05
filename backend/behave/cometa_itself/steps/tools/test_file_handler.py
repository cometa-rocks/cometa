from threading import Lock


# This class is used to handle the downloaded files in the browser
# When a container is created it will create a folder with random name within the container and shared that folder with behave.
# This folder will be responsible for storing upload and downloaded files
# i.e if my folder name is 1234567890, then the folder with in the behave will be /tmp/1234567890 and 
# With in the container for upload file it will be /selenium/1234567890/upload
# With in the container for downloaded file it will be /selenium/1234567890/download
# Mounting between behave and containers
# behave/department_file/department_id/upload  -> /selenium/1234567890/upload, Share all uploaded files within department to browser container 
# behave/department_file/department_id/feature_execution_id/download  -> /selenium/1234567890/download
# Since multiple execution can happen in parallel which might download file same name
# So we need to share the unique download folder within browser container

# problem: that i need solve, if a container is already created as standby, 
# then how to share the a particular department uploaded files to the container 
# As during creation we don't know, by which department container files will be used

# solution: using container cp command copy all container files from data/cometa/department/upload folder to /selenium/1234567890/upload folder
# and do wise versa for downloaded files to cp download file from /selenium/1234567890/download folder to data/cometa/department/feature_execution_id/download folder

class TestFileHandler:
    def __init__(self):
        self.downloaded_files = defaultdict(list)
        self.downloaded_files_lock = Lock()

    def get_downloaded_files(self, context):
        with self.downloaded_files_lock:
            return self.downloaded_files

    def add_downloaded_file(self, context, file_path):
        with self.downloaded_files_lock:
            self.downloaded_files[context.browser.session_id].append(file_path)