from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.core.files.uploadhandler import TemporaryFileUploadHandler
from django.core.files.uploadedfile import UploadedFile
from django.core.files import temp as tempfile
from django.conf import settings
import subprocess, magic, os, sys, requests, re
from backend.common import UPLOADS_FOLDER
from backend.models import File
from backend.serializers import FileSerializer
from backend.utility.functions import getLogger
sys.path.append("/code")
from secret_variables import COMETA_UPLOAD_ENCRYPTION_PASSPHRASE

# logger information
logger = getLogger()

"""
Docs: https://docs.djangoproject.com/en/4.1/_modules/django/core/files/uploadedfile/#TemporaryUploadedFile
"""
class TempUploadedFile(UploadedFile):
    """
    A file uploaded to a temporary location (i.e. stream-to-disk).
    """

    def __init__(self, name, content_type, size, charset, content_type_extra=None):
        _, ext = os.path.splitext(name)
        file = tempfile.NamedTemporaryFile(
            suffix=".cometa.upload" + ext, dir=settings.FILE_UPLOAD_TEMP_DIR, delete=False
        )
        super().__init__(file, name, content_type, size, charset, content_type_extra)

    def temporary_file_path(self):
        """Return the full path of this file."""
        return self.file.name


    def close(self):
        try:
            return self.file.close()
        except FileNotFoundError:
            # The file was moved or deleted before the tempfile could unlink
            # it. Still sets self.file.close_called and calls
            # self.file.file.close() before the exception.
            pass

"""
Docs: https://docs.djangoproject.com/en/4.1/_modules/django/core/files/uploadhandler/#TemporaryFileUploadHandler
"""
class TempFileUploadHandler(TemporaryFileUploadHandler):
    def new_file(self, *args, **kwargs):
        """
        Create the file object to append to as data is coming in.
        """
        super().new_file(*args, **kwargs)
        self.file = TempUploadedFile(
            self.file_name, self.content_type, 0, self.charset, self.content_type_extra
        )

"""

"""
class UploadFile():

    """
    
    """
    def __init__(self, file: TempUploadedFile, department_id: int, uploaded_by: int):
        logger.debug(f"Upload file request: {file.name} for department id {department_id} and uploaded by {uploaded_by}.")
        self.tempFile: TempUploadedFile = file
        self.department_id: int = department_id
        self.uploaded_by: int = uploaded_by
        self.filename = self.sanitize(self.tempFile.name) 
        self.finalPath = self.generateFinalPath()
        self.uploadPath = f"uploads/{file.name}"
        logger.debug(f"Final path for the file generated: {self.finalPath}")
        self.file: File = self.generateTempObject(*self.getFileProperties())

    def proccessUploadFile(self) -> File:
        self.file.status = "Processing"
        logger.debug(f"Processing {self.tempFile.name}...")
        # send a websocket about the processing being done.
        self.sendWebsocket({
            "type": "[Files] Processing",
            "file": FileSerializer(self.file, many=False).data
        })

        # check if file already exists
        if os.path.exists(self.finalPath):
            logger.error("File already exists ... will not save.")
            self.deleteTemp()
            # send a websocket about the processing being done.
            self.file.status = "Error"
            self.sendWebsocket({
                "type": "[Files] Error",
                "file": FileSerializer(self.file, many=False).data,
                "error": {
                    "status": f"FILE_ALREADY_EXIST",
                    "description": f"File already exists with the same name, please try removing old file or rename the file."
                }
            })
            return None

        # check for virus
        try:
            self.virusScan()
            self.encrypt()
        except Exception as err:
            return None
        
        # finally save the object if everything went well
        self.file.status = "Done"
        self.file.save()
        # send a websocket about the processing being done.
        self.sendWebsocket({
            "type": "[Files] Done",
            "file": FileSerializer(self.file, many=False).data
        })
        # delete the temporary file that was generated
        self.deleteTemp()

    def virusScan(self):
        self.file.status = "Scanning"
        # send a websocket about the processing being done.
        self.sendWebsocket({
            "type": "[Files] Scanning",
            "file": FileSerializer(self.file, many=False).data
        })

        # start with scanning
        tempFilePath = self.tempFile.temporary_file_path()
        result = subprocess.run(["bash", "-c", f"clamscan {tempFilePath} | grep {tempFilePath}"], stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        if result.returncode > 0:
            # get the error
            errOutput = result.stderr.decode('utf-8')
            logger.error(errOutput)
            raise Exception('Failed to scan the file, please contact an administrator.')
        
        output = result.stdout.decode("utf-8")
        file, virus = output.split(": ")

        if not virus.startswith("OK"):
            error = f"{self.tempFile.name} contains some sort of virus: {virus}."
            self.deleteTemp()
            logger.error(error)
            # send a websocket about the processing being done.
            self.file.status = "Error"
            self.sendWebsocket({
                "type": "[Files] Error",
                "file": FileSerializer(self.file, many=False).data,
                "error": {
                    "status": f"FILE_VIRUS_DETECTED",
                    "description": error
                }
            })
            raise Exception(error)
    
    def getFileProperties(self):
        fileText = magic.from_file(self.tempFile.temporary_file_path())
        fileMime = magic.from_file(self.tempFile.temporary_file_path(), mime=True)
        fileSize = self.tempFile.size
        result = subprocess.run(["bash", "-c", f"md5sum \"{self.tempFile.temporary_file_path()}\""], stdout=subprocess.PIPE)
        output = result.stdout.decode("utf-8")
        fileMD5Sum = output.split(" ")[0]

        return fileText, fileMime, fileSize, fileMD5Sum
    
    def generateFinalPath(self):
        finalDir = f"{UPLOADS_FOLDER}/{self.department_id}"
        # make sure finalDir exists
        os.makedirs(finalDir, 0o755, True)

        return f'{finalDir}/{self.filename}'

    def encrypt(self):
        self.file.status = "Encrypting"
        # send a websocket about the processing being done.
        self.sendWebsocket({
            "type": "[Files] Encrypting",
            "file": FileSerializer(self.file, many=False).data
        })

        # start encryption
        source = self.tempFile.temporary_file_path()
        target = self.finalPath
        logger.debug(f"Moving {source} to {target}.")
        try:
            result = subprocess.run(["bash", "-c", f"gpg --output {target} --batch --passphrase {COMETA_UPLOAD_ENCRYPTION_PASSPHRASE} --symmetric --cipher-algo AES256 {source}"], stdout=subprocess.PIPE, stderr=subprocess.PIPE)
            if result.returncode > 0:
                # get the error
                errOutput = result.stderr.decode('utf-8')
                logger.error(errOutput)
                raise Exception('Failed to encrypt the file, please contact an administrator.')
        except Exception as err:
            logger.error(f"Unable to move the file from source to target.", err)
            self.deleteTemp()
            # send a websocket about the processing being done.
            self.file.status = "Error"
            self.sendWebsocket({
                "type": "[Files] Error",
                "file": FileSerializer(self.file, many=False).data,
                "error": {
                    "status": f"FILE_ENCRYPTION_FAILED",
                    "description": f"Unable to encrypt the file ... please contact an administrator."
                }
            })
            raise Exception(str(err))
    
    def generateTempObject(self, text, mime, size, md5sum):
        logger.debug(f"Generating temporary File object with name {self.tempFile.name}.")
        try:
            file: File = File(
                name = self.tempFile.name,
                path = self.finalPath,
                uploadPath = self.uploadPath,
                size = size,
                type = text,
                mime = mime,
                md5sum = md5sum,
                department_id = self.department_id,
                uploaded_by_id = self.uploaded_by,
                status = "Unknown"
            )
        except Exception as err:
            logger.error("Exception occured while trying to create an object...", err)
            file = None
        return file

    def deleteTemp(self):
        try:
            os.remove(self.tempFile.temporary_file_path())
            return True
        except Exception as err:
            logger.error("Unable to remove temp file.", err)
            return False
    
    def sendWebsocket(self, payload):
        response = requests.post('http://cometa_socket:3001/sendAction', json=payload)
        return response
    
    def sanitize(self, filename: str):
        return re.sub(r'[^A-Za-z0-9\.]', '-', filename)
