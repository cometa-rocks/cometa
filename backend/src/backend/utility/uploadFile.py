from itertools import islice
from django.views.decorators.csrf import csrf_exempt
from django.core.files.uploadhandler import TemporaryFileUploadHandler
from django.core.files.uploadedfile import UploadedFile
from django.core.files import temp as tempfile
from django.conf import settings
import subprocess, magic, os, sys, requests, re, json
from backend.common import UPLOADS_FOLDER
from backend.models import File, FileData
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

def decryptFile(source):
    import tempfile
    target = "/tmp/%s" % next(tempfile._get_candidate_names())

    logger.debug(f"Decrypting source {source}")

    try:
        result = subprocess.run(["bash", "-c", f"gpg --output {target} --batch --passphrase {COMETA_UPLOAD_ENCRYPTION_PASSPHRASE} -d {source}"], stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        if result.returncode > 0:
            # get the error
            errOutput = result.stderr.decode('utf-8')
            logger.error(errOutput)
            raise Exception('Failed to decrypt the file, please contact an administrator.')
        return target
    except Exception as err:
        raise Exception(str(err))

def getFileContent(file: File):
    # decrypt file
    targetPath = decryptFile(file.path)

    import pandas as pd
    try:
        df = pd.read_csv(targetPath, header=0, skipinitialspace=True, skip_blank_lines=True)
    except ValueError:
        try:
            df = pd.read_excel(targetPath, header=0)
        except:
            logger.info("saving data...")
            file.extras['ddr'] = {
                'data-driven-ready': False,
                'reason': 'Unable to parse Excel or CSV file, please upload a valid Excel or CSV file.'
            }
            file.save()
            raise Exception("Unable to parse excel or csv file.")
    
    # replace " " with "_" and to lower the column names
    df.columns = df.columns.str.replace(" ", "_").str.lower()

    # check if feature id or feature name column is present
    if 'feature_id' not in df.columns and 'feature_name' not in df.columns:
        file.extras['ddr'] = {
            'data-driven-ready': False,
            'reason': 'Missing \'feature_id\' or \'feature_name\' columns, please add one and re-upload.'
        }
        file.save()
        raise Exception("Missing 'Feature id' or 'Feature Name' columns, please add one and re-try.")

    # convert row to json
    json_data = df.to_json(orient='records', lines=True).splitlines()

    # add all the lines to the FileData
    rows = (FileData(file=file, data=json.loads(data)) for data in json_data)
    
    # how many row we want to save in single query
    batch_size = 100
    file_data = []
    while True:
        batch = list(islice(rows, batch_size))
        if not batch:
            break
        file_data.extend(FileData.objects.bulk_create(batch, batch_size))

    file.extras['ddr'] = {
        'data-driven-ready': True
    }
    file.save()

    return file_data

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
        self.uploadPath = f"uploads/{self.filename}"
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
            self.deleteFile(self.tempFile.temporary_file_path())
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
        try:
            # ddr required file id
            self.file.save()
            # check the ddr
            self.check_data_driven()
            # update the status
            self.file.status = "Done"
            self.file.save()
        except Exception as err:
            logger.error("Exception occured while trying to save file to database.")
            logger.exception(err)
            # send a websocket about the processing being done.
            self.file.status = "Error"
            self.sendWebsocket({
                "type": "[Files] Error",
                "file": FileSerializer(self.file, many=False).data,
                "error": {
                    "status": f"UNABLE_TO_SAVE_FILE",
                    "description": f"Error occurred when trying to save the file to database, please try again later or contact an administrator."
                }
            })
            self.deleteFile(self.finalPath)
            return None
        # send a websocket about the processing being done.
        self.sendWebsocket({
            "type": "[Files] Done",
            "file": FileSerializer(self.file, many=False).data
        })
        # delete the temporary file that was generated
        self.deleteFile(self.tempFile.temporary_file_path())

    def virusScan(self):
        self.file.status = "Scanning"
        logger.debug(f"Scanning for virus {self.tempFile.name}...")
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
            self.deleteFile(self.tempFile.temporary_file_path())
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
        logger.debug(f"Encrypting {self.tempFile.name}...")
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
            self.deleteFile(self.tempFile.temporary_file_path())
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

    def deleteFile(self, file):
        try:
            os.remove(file)
            return True
        except Exception as err:
            logger.error(f"Unable to remove file ({file}).")
            logger.exception(err)
            return False
    
    def sendWebsocket(self, payload):
        response = requests.post('http://cometa_socket:3001/sendAction', json=payload)
        return response
    
    def sanitize(self, filename: str):
        return re.sub(r'[^A-Za-z0-9\.]', '-', filename)
    
    def check_data_driven(self):
        logger.debug(f"Checking if file {self.tempFile.name} is data-driven ready ...")
        self.file.status = "DataDriven"
        # send a websocket about the processing being done.
        self.sendWebsocket({
            "type": "[Files] Checking Data Driven",
            "file": FileSerializer(self.file, many=False).data
        })
        try:
            getFileContent(self.file)
        except Exception as err:
            logger.warning(f"{self.file.name} is not DDR Ready.")
