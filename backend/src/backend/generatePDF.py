# Models
from backend.models import *

# Addons and essentials
from django.shortcuts import render
from django.core.mail import send_mail
from shutil import copyfile, copy, move
from django.views.generic import View
from xhtml2pdf import pisa
from django.template.loader import get_template
from io import BytesIO
from zoneinfo import ZoneInfo
from django.core.mail import EmailMultiAlternatives
from django.core.exceptions import ValidationError
from django.core.validators import validate_email
from rest_framework.response import Response
from django.conf import settings
import base64, os
from django.http import HttpResponse
from backend.views import render_to_pdf, bytesToMegaBytes
from backend.common import *
from backend.utility.functions import getLogger
from django.forms.models import model_to_dict
# just to import secrets
import sys, traceback
from os.path import isfile, exists
sys.path.append("/code")
import pytz
# Python basics
import logging
import logging.handlers
import datetime
from email.mime.image import MIMEImage
from PIL import Image
from backend.utility.configurations import ConfigurationManager

# logger information
logger = getLogger()

DOMAIN = ConfigurationManager.get_configuration('COMETA_DOMAIN', '')
SCREENSHOT_PREFIX = ConfigurationManager.get_configuration('COMETA_SCREENSHOT_PREFIX', '')



class PDFAndEmailManager:
    
    def __init__(self) -> None:
        self.__pdf_generated = False
    
    def is_pdf_generated(self) -> bool:
        return self.__pdf_generated
    
    
      # Initialization. This is the main function, this executes all the class. We get here from URL /pdf/.
    # All of the steps are functions from this class. Each function has information about it before being declared.
    def prepare_the_get(self, request):
        # Get the request
        self.request = request
        self.__step_variable_values = []

        #  logger assignment
        self.my_logger = logger

        # save the pdf content to a variable for easy access later on
        self.PDFContent = ""
        
        # Get the feature result id via get. We do it in here plain
        self.feature_result_id = self.request.GET.get('feature_result_id', None)
        if not self.feature_result_id:
            raise ValueError("FeatureResultID not passed")
        if not str(self.feature_result_id).isnumeric():
            raise ValueError("Invalid FeatureResultID passed")
        # Filter objects to get that result id
        self.feature_result = self.GetFeatureResult()


        # Get the steps from the executed feature.
        self.steps = Step_result.objects.filter(feature_result_id=self.feature_result_id).order_by("step_result_id")

        # Get the feature result screenshots.
        self.screenshots_array = self.GetStepsAndScreenshots()

        # Calculate percentatge of OK steps and NOK steps
        try:
            self.percentok = int((self.feature_result.ok * 100) / self.feature_result.total)
        except ZeroDivisionError:
            self.percentok = 0
        try:
            self.percentnok = int(((self.feature_result.fails + self.feature_result.skipped) * 100) / self.feature_result.total)
        except ZeroDivisionError:
            self.percentnok = 0
        self.totalnok = int(self.feature_result.fails) + int(self.feature_result.skipped)

        # Assigning class variables to use in all the functions.
        self.feature_template = self.feature_result.feature_id
        self.feature_id = self.feature_result.feature_id_id
        
        # Take path from fature_result and check if the pdf was generated
        self.downloadFullPath = self.feature_result.pdf_result_file_path 
        
        # PDF Generation code start here
        # check if file already exists
        if not exists(self.downloadFullPath):
            # save the pdf download path
            self.downloadPath = "/code/behave/pdf"
            self.pdf_file_name = "%s-%s.pdf" % (str(self.feature_result.feature_name), str(self.feature_result_id))
            self.downloadFullPath = "%s/%s" % (self.downloadPath, self.pdf_file_name)

            # check if download path exists
            if not exists(self.downloadPath):
                self.my_logger.debug("Download path does not exists .... creating one...")
                os.makedirs(self.downloadPath)

            # check if lock file exists if so that mean the pdf file is being generate
            if exists(self.downloadFullPath + ".lock"):
                return HttpResponse("PDF File for Feature: %s and Feature Result ID: %s is still being generated, please try again later." % (str(self.feature_result.feature_name), str(self.feature_result_id)))

            # generate pdf url
            self.pdfURL = "https://%s/backend/pdf/?feature_result_id=%s" % (DOMAIN, self.feature_result_id)

            # If the request GET parameter "download" is present, download the PDF instead of emailing it to it's recipient
            download = self.request.GET.get('download', None)
                
            # create a lock file to check if pdf is still being generated or not
            self.touch(self.downloadFullPath + ".lock")
            
            self.my_logger.debug("Creating a lock file for %s" % self.downloadFullPath)

            # Build the HTML and then render it into a PDF.
            self.pdf = self.BuildHtmlAndRenderPdf()
            
            # save the pdf to file
            with open(self.downloadFullPath, 'wb') as f:
                f.write(self.pdf.content)
            
            # remove lock file once finished
            if exists(self.downloadFullPath + ".lock"):
                self.my_logger.debug("Removing lock file for %s" % self.downloadFullPath)
                os.remove(self.downloadFullPath + ".lock")
            
            self.feature_result.pdf_result_file_path = self.pdf_file_name
            
            # Saving pdf file name in FeatureResults it will help to do housekeeping
            
        self.feature_result.house_keeping_done = False
        self.feature_result.save()
        
        # Validate the emails. If emailsend is set to false or all emails are bad, we get out of execution.
        # We don't raise exception here to not cause issues when debugging, as having email set as false is not an error.
        # 2020-07-28 ABP Mark this "if" as an exception to download parameter, email send is not required to download directly the PDF file
        if (download != 'true' and download != 'false') and self.ValidateEmails() == False:
            return HttpResponse("400 - Invalid email address(es).")

        # read file content and save it to PDFContent
        with open(self.downloadFullPath, 'rb') as f:
            PDFContent = f.read()
        
        # download param should contain something, otherwise it is considered Falsy, ex: ?download=true
        if download == 'true':
            # Download the PDF
            response = HttpResponse(PDFContent, content_type='application/pdf')
            response['Content-Disposition'] = 'attachment; filename="%s-%s.pdf"' % (str(self.feature_result.feature_name), str(self.feature_result.result_date))
            response['Content-Length'] = len(PDFContent)
            return response
        elif download == 'false':
            # Send response with PDF preview
            response = HttpResponse(PDFContent, content_type='application/pdf')
            response['Content-Disposition'] = 'inline; filename="%s-%s.pdf"' % (str(self.feature_result.feature_name), str(self.feature_result.result_date))
            response['Content-Length'] = len(PDFContent)
            return response
        else:
            self.send_mail()
            
        # Finish
        return HttpResponse("200")

    
    """
        This function handles the logic of sending the mail
    """
    def send_mail(self):
        feature = Feature.objects.get(feature_id=self.feature_id)
        self.feature = feature
        should_send_the_email = True
        
        # if feature is set to check for notification on error 
        if feature.check_maximum_notification_on_error:
            logger.debug("Checking for maximum emails on error")
            # Check if current feature_result is failed
            # Check if number of sent notifications are less then maximum number set to send the notification  
            if self.feature_result.success and not feature.send_mail_on_error:
                should_send_the_email = True
                feature.number_notification_sent = 0
                
            elif self.feature_result.success:
                should_send_the_email = False
                feature.number_notification_sent = 0                
                                
            # Send email and increase number_notification_sent count by 1
            elif feature.number_notification_sent < feature.maximum_notification_on_error:
                feature.number_notification_sent = feature.number_notification_sent + 1 
                should_send_the_email = True
                
            elif feature.number_notification_sent >= feature.maximum_notification_on_error:
                should_send_the_email = False
        # In check_maximum_notification_on_error set number_notification_sent to 0 so that user can get the notification when new error is there
        else:
            feature.number_notification_sent = 0 
        
        feature.save()
            
        if should_send_the_email:
            # Build the subject and the emailbody.
            self.subject = self.BuildEmailSubject()
            self.emailbody = self.BuildEmailBody()

            # Send the email.
            self.SendEmail()

        else:
            logger.info("Skip sending email ")
    """
        This function starts a logger to output information into syslog. It uses python default logger object.
    """
    def StartLogger(self):
        my_logger = logging.getLogger('MyLogger')
        handler = logging.StreamHandler()
        formatter = logging.Formatter('[%(asctime)s] %(message)s ')
        handler.setFormatter(formatter)
        my_logger.addHandler(handler)
        my_logger.setLevel(logging.DEBUG)

        return my_logger

    """
        Small function for touch functionality
    """
    def touch(self, fname):
        try:
            os.utime(fname, None)
        except OSError:
            open(fname, 'a').close()

    """
        Get the current feature result and check that it actually exists.
    """
    def GetFeatureResult(self):
        try:
            feature_result = Feature_result.objects.get(feature_result_id=self.feature_result_id)
        except Feature_result.DoesNotExist:
            # If the feature is not found then we return error, if not get item
            self.my_logger.critical('[GeneratePDF] Error while retrieving feature info: Feature not found.')
            raise ValueError("503 Feature not found")
        
        if isinstance(feature_result.browser, str):
            feature_result.browser = json.loads(feature_result.browser)
        return feature_result

    """
     Email valiadation. We get all the emails, run them into django validator and remove the invalid ones.
     Also, if there send email is set to false, get out of the function.
    """
    def ValidateEmails(self):
        
        # If the email does not need to get sent, get out...
        if(self.feature_template.send_mail == False):
            self.my_logger.debug("[GeneratePDF] "+str(self.feature_result.feature_id)+" | Send email is set to False. No email sent.")
            return False

        # Check if the email is send on error only. If it is, check feature errors. If there is no errors, get out of execution and don't send email.
        if(self.feature_template.send_mail_on_error == True):
            self.my_logger.debug("[GeneratePDF] "+str(self.feature_result.feature_id)+" | Send email is set to Send On Error.")
            if(self.feature_result.fails <= 0):
                self.my_logger.debug("[GeneratePDF] "+str(self.feature_result.feature_id)+" | No errors. Email not sent.")
                return False
            else:
                self.my_logger.debug("[GeneratePDF] "+str(self.feature_result.feature_id)+" | Errors found. Will send email.")

        # Bad e-mail checking. If an email is not valid, it will get deleted. 
        # This is done to protect user from sending emails to unwanted directions.
        bad_emails = []
        for email in self.feature_template.email_address or []:
            email = email.strip()
            try:
                validate_email(email)
                self.my_logger.debug("[GeneratePDF] "+str(self.feature_result.feature_id)+" | Valid e-mail ("+email+")")
            except ValidationError as e:
                bad_emails.append(email)
                self.my_logger.debug("[GeneratePDF] "+str(self.feature_result.feature_id)+f" | Invalid e-mail {email}. Removed from list.")
            
        # We remove them here as it is a bad practice to remove items for the list we are iterating on.
        for bad_email in bad_emails:
            self.feature_template.email_address.remove(bad_email)

        # Bad e-mail checking. If an email is not valid, it will get deleted. 
        # This is done to protect user from sending emails to unwanted directions.
        bad_cc_emails = []
        for email in self.feature_template.email_cc_address or []:
            email = email.strip()
            try:
                validate_email(email)
                self.my_logger.debug("[GeneratePDF] "+str(self.feature_result.feature_id)+" | Valid e-mail ("+email+")")
            except ValidationError as e:
                bad_cc_emails.append(email)
                self.my_logger.debug("[GeneratePDF] "+str(self.feature_result.feature_id)+f" | Invalid CC e-mail {email}. Removed from list.")
            
        # We remove them here as it is a bad practice to remove items for the list we are iterating on.
        for bad_email in bad_cc_emails:
            self.feature_template.email_cc_address.remove(bad_email)
       
       
       
        # Bad e-mail checking. If an email is not valid, it will get deleted. 
        # This is done to protect user from sending emails to unwanted directions.
        bad_bcc_emails = []
        for email in self.feature_template.email_bcc_address or []:
            email = email.strip()
            try:
                validate_email(email)
                self.my_logger.debug("[GeneratePDF] "+str(self.feature_result.feature_id)+" | Valid e-mail ("+email+")")
            except ValidationError as e:
                bad_bcc_emails.append(email)
                self.my_logger.debug("[GeneratePDF] "+str(self.feature_result.feature_id)+f" | Invalid BCC e-mail {email}. Removed from list.")
            
        # We remove them here as it is a bad parctice to remove items for the list we are iterating on.
        for bad_email in bad_bcc_emails:
            self.feature_template.email_cc_address.remove(bad_email)
        
                # If all emails are removed then dont proceed
        if len(self.feature_template.email_address) + len(self.feature_template.email_cc_address) + len(self.feature_template.email_bcc_address) == 0:
            self.my_logger.debug("[GeneratePDF] "+str(self.feature_result.feature_id)+" | All e-mails were invalid and they were not sent. Exiting.")
            return False 
                
        # All good
        return True

    """
        Get all the steps of the feature, and then, get all the screenshots for each step. 
        Then, save them into an array and return it to the main function.
    """
    def GetStepsAndScreenshots(self):
        # Create screenshots dictionary and initialize count for managing
        screenshots_array = dict()
        count = 1
        
        # Dict containing all images in base64 from the feature, separated in step_result_id
        for step in self.steps:
            # Create photos list
            listphotos = []
            
            if isinstance(step.current_step_variables_value, dict):
                variable_info = {}
                variable_value = step.current_step_variables_value.get('variable_value', None)
                variable_info['variable_name'] = step.current_step_variables_value.get('variable_name', None)
                if isinstance(variable_value, dict) or isinstance(variable_value, list):
                    # If variable_value is a dict, we need to convert it to a list
                    variable_info['variable_value'] = json.dumps(variable_value)
                else:
                    variable_info['variable_value'] = step.current_step_variables_value.get('variable_value')
                        
                self.__step_variable_values.append(variable_info)
            
            
            
            # Count to enumerate steps, as django templates language cannot modify variables
            step.count = count
            count = count + 1
            # Trim the step name to get a maximum of 60 characters
            # 
            # if len(step.step_name) > 57:
            #     step.step_name = step.step_name[:57] + '...'
            # Iterate over each screenshot
            fields = ['current', 'style', 'difference']
            for field in fields:
                # Construct image path
                path = settings.SCREENSHOTS_ROOT + getattr(step, 'screenshot_' + field, '')
                # Check file in database exists
                if isfile(path):
                    # Open image and convert to base64
                    with open(path, "rb") as file:
                        photo = base64.b64encode(file.read()).decode('utf-8')
                        # Push it to list of photos
                        listphotos.append(photo)
                else:
                    # Try to get the image from the old system
                    photo = None
                    if field == 'current':
                        photo = settings.SCREENSHOTS_ROOT + SCREENSHOT_PREFIX + str(step.step_result_id) + '.png'
                    elif field == 'style':
                        photo = settings.SCREENSHOTS_ROOT + SCREENSHOT_PREFIX + str(step.step_result_id) + '_style.png'
                    elif field == 'difference':
                        photo = settings.SCREENSHOTS_ROOT + SCREENSHOT_PREFIX + str(step.step_result_id) + '.png_diff.png'
                    # Check if old image exists and try to read as base64
                    if photo and isfile(photo):
                        # Open image and convert to base64
                        with open(path, "rb") as file:
                            photo = base64.b64encode(file.read()).decode('utf-8')
                            # Push it to list of photos
                            listphotos.append(photo)
                     
            # Build the steps array. This array contains the images sorted, and all steps data to use for the images and screenshot generation
            screenshots_array[step.step_result_id] = []
            screenshots_array[step.step_result_id].append({'step_name': step.step_name})
            screenshots_array[step.step_result_id].append({'execution_time': int(step.execution_time)})
            screenshots_array[step.step_result_id].append({'pixel_diff': step.pixel_diff})
            screenshots_array[step.step_result_id].append({'success': step.success})
            screenshots_array[step.step_result_id].append({'photo1': None})
            screenshots_array[step.step_result_id].append({'photo2': None})
            screenshots_array[step.step_result_id].append({'photo3': None})
            screenshots_array[step.step_result_id].append({'count' : step.count})
            screenshots_array[step.step_result_id].append({'error': step.error})
            screenshots_array[step.step_result_id].append({'variables_value': step.current_step_variables_value})
            # Change the images from None to the base64 string, only if the image exists. We use i+4 because screenshots are located in indexs 4 5 and 6
            for i in range(0, len(listphotos)):
                index = i+4
                photoindex = 'photo'+str(i+1)
                update = { photoindex: listphotos[i]}
                screenshots_array[step.step_result_id][index].update(update)
                
        return screenshots_array

    """
        Using all the data we managed, we build a HTML report of the feature result, using Django Templates.
        Once this HTML is rendered, using XHTML2PDF package, we transform it into a fully working PDF.
        Then, we return this PDF to the main function.
    """
    def BuildHtmlAndRenderPdf(self):
        # Get template base / html.
        template = get_template('generatePDF.html')
        # Get the browser name and version
        browserinfo = self.feature_result.browser['browser']+" "+str(self.feature_result.browser['browser_version'])
        domain = 'https://%s' % DOMAIN
        # Send the context to the template. The context in this case is a dictionary containing variables with value to use in the template.
        date_time = self.feature_result.result_date.replace(tzinfo=ZoneInfo('UTC'))
        utc_date =  date_time.astimezone(pytz.timezone('UTC')).strftime('%Y-%m-%d %H:%M:%S %Z')
        cet_date =  date_time.astimezone(pytz.timezone('Europe/Berlin')).strftime('%Y-%m-%d %H:%M:%S %Z')
        ist_date =  date_time.astimezone(pytz.timezone('Asia/Kolkata')).strftime('%Y-%m-%d %H:%M:%S %Z')
        context = {
            "invoice_id": self.feature_result.feature_name,
            "utc_date": utc_date,
            "cet_date": cet_date,
            "ist_date": ist_date,
            "stepsarray": self.steps,
            "step_variable_values": self.__step_variable_values,
            "domain": domain,
            "featureinfo": self.feature_result,
            "percentok": self.percentok,
            "percentnok": self.percentnok,
            "totalnok": self.totalnok,
            "screenshots_array": self.screenshots_array,
            "browserinfo": browserinfo,
        }
        
        # Render template to HTML
        try:
            html = template.render(context)
            # Render HTML to PDF
            pdf = render_to_pdf('generatePDF.html', context)
            self.__pdf_generated = True
            return pdf
        
        except Exception as e:
            self.my_logger.critical("[GeneratePDF] "+str(self.feature_result.feature_id)+" | Error while rendering the PDF. Error stack trace: ", e)
            raise ValueError("Error while rendering the PDF")

    """
        Replaces the feature variables for the given text
    """
    def replaceFeatureVariables(self, text):
        from backend.utility.variable_replacement import replace_feature_variables
        return replace_feature_variables(text, self.feature_result, use_html_breaks=True)

    """
        Email Subject Building, if there is no subject, a default one will be created.
        If at least one step failed, the subject will contain X FAILED.
        If not, it will contain the number of OK tests.
    """
    def BuildEmailSubject(self):
        
        if self.feature_template.email_subject == None or self.feature_template.email_subject == '':
            # Create default remplate 
            subject = '[COMETA][%s] %s%s | %d OK | %d NOK' % (
                str(self.feature_template.feature_id),
                self.feature_result.feature_name[:emailSubjectFeatureNameLimit],
                "..." if len(self.feature_result.feature_name) > emailSubjectFeatureNameLimit else '',
                self.feature_result.ok,
                self.totalnok
            )
        else:
            subject = str(self.feature_template.email_subject)
            # Replace variables of feature
            subject = self.replaceFeatureVariables(subject)

        return subject

    """
        Building the email body.
        Creating the body of the e-mail. If there is no body, there will be one by default. A sign is added in the end of the email.
        We send it back to the main function.
    """
    def process_custom_body_for_screenshots(self,email_multi_alternatives) -> dict:
        logger.debug("Processing custom body")
        # get all the steps in the feature results
        step_results_screenshots = Step_result.objects.values_list('screenshot_current') \
        .filter(feature_result_id=self.feature_result_id) \
        .exclude(screenshot_current__exact='') \
        .order_by("step_result_id")
        # Define the regex pattern
        pattern = r'\$screenshot\[((-?\d+)|last)\]'
        
        # Find all matches and their positions
        matches = list(re.finditer(pattern, self.feature_template.email_body))
        new_email_body =  "<strong>Custom message:</strong><br><br>"+self.feature_template.email_body+"<br><br>"
        # Print the matches with their positions
        invalid_screenshot_names = []
        number_of_screen_shot = len(step_results_screenshots)
        for match in matches:
            try:
                # Get the screenshot name i.e. $screenshot[n]
                screenshot_name =  match.group(0)
                # Get the screenshot index 'n'
                screen_shot_index = match.group(1)
                logger.debug(f'{screen_shot_index} {number_of_screen_shot}')                            

                if screen_shot_index=='last':
                    screen_shot_index=-1
                else:
                    screen_shot_index = int(screen_shot_index)
                
                # logger.debug("Found match ")
                # logger.debug(f"Match: {match.group(0)}, Number: {match.group(1)}, Start: {match.start()}, End: {match.end()}")
                # This is to check if number of screenshot available in the step report are less or equal to screenshot index requested in the email 
                
                if screen_shot_index<0:
                    logger.debug(f"Processing negative SS index : {screen_shot_index}")   
                    screen_shot_index = number_of_screen_shot - abs(screen_shot_index) + 1       
                    logger.debug(f"Converted to : {screen_shot_index}")    
                if screen_shot_index>0 and number_of_screen_shot>=screen_shot_index:
                    # Create dictionary with $screenshot[n] = path/to/screenshot
                    # logger.debug("Attaching screenshots")
                    logger.debug(step_results_screenshots[screen_shot_index-1])
                    screen_shot = step_results_screenshots[screen_shot_index-1][0]
                    # Add image tag to show image in with mail
                    image_path = os.path.join(settings.SCREENSHOTS_ROOT, screen_shot)
                    image_name = image_path.split("/")
                    logger.debug(image_name)
                    if len(image_name)>0:
                        image_name = image_name[-1].split(".")[-2]
        
                    image_name+='.png'
                    logger.debug(image_name)
                    new_email_body = new_email_body.replace(screenshot_name, f'<img src="cid:{screenshot_name}" alt={image_name} >')
                    # logger.debug(name)
                    # logger.debug(new_email_body)
                    # logger.debug(f"Attaching Screenshot {screen_shot}")
                    with Image.open(image_path) as img:
                        with BytesIO() as output:
                            img.save(output, format='PNG')
                            png_data = output.getvalue()                    
                        mime_image = MIMEImage(png_data, _subtype="png")
                        mime_image.add_header('Content-ID', f'<{screenshot_name}>')
                        mime_image.add_header('X-Attachment-Id', f'{screenshot_name}')
                        mime_image.add_header('Content-Disposition', 'inline', filename=image_name)
                        email_multi_alternatives.attach(mime_image)
                else:
                    invalid_screenshot_names.append(screenshot_name)
            except:
                logger.error(f"Exception while attaching $screenshot variable {screenshot_name}")
                traceback.print_exc()
                invalid_screenshot_names.append(screenshot_name)                
        if invalid_screenshot_names:
            new_email_body += f"<b>Invalid Screenshot names: <b> {','.join(invalid_screenshot_names)}"
        
        new_email_body = self.replaceFeatureVariables(new_email_body)

        return new_email_body, email_multi_alternatives

    def _get_failed_steps_for_email(self):
        """Get HTML formatted failed steps information for email"""
        if self.feature_result.success or self.feature_result.fails <= 0:
            return ""
        
        failed_steps = [step for step in self.steps if not step.success]
        if not failed_steps:
            return ""
        
        html = "<br><strong>Failed Steps:</strong><br><ul>"
        for step in failed_steps:
            step_name = step.step_name or f"Step {step.step_execution_sequence}"
            error = (step.error or "No error message").strip()
            if len(error) > 200:
                error = error[:200] + "..."
            html += f"<li><strong>Step {step.step_execution_sequence}: {step_name}</strong><br><em>{error}</em></li>"
        html += "</ul><br>"
        return html

    def BuildEmailBody(self):
        date_time = self.feature_result.result_date.replace(tzinfo=ZoneInfo('UTC'))
        utc_date =  date_time.astimezone(pytz.timezone('UTC')).strftime('%Y-%m-%d %H:%M:%S %Z')
        
        # Get browser selected timezone
        browser_info = self.feature_result.browser
        browser_timezone = browser_info.get('selectedTimeZone', 'UTC') if browser_info else 'UTC'
        
        # Format browser timezone if different from UTC
        browser_date = ""
        if browser_timezone != 'UTC':
            try:
                browser_date = date_time.astimezone(pytz.timezone(browser_timezone)).strftime('%Y-%m-%d %H:%M:%S %Z')
            except Exception as e:
                self.my_logger.warning(f"Invalid browser timezone '{browser_timezone}': {e}")
                browser_date = f"Browser timezone: {browser_timezone}"

        pdf_email_part = ""

        if len(self.pdf.content) >= pdfFileSizeLimit and self.feature.attach_pdf_report_to_email:
           pdf_email_part = """
            PDF file size (%.2fMB) is over the threshold (%.2fMB) and will not be attached to the email, choose from options below to either download of view the pdf:
            <ul>
                <li><strong><a href="%s">Download PDF</a></strong></li>
                <li><strong><a href="%s">View PDF</a></strong></li>
            </ul><br>
            Attachment file size allowed is a system wide property in common.py. If you would like to change it, please contact the system administrator of your mail server or the cometa installation.
            <br><br>
            """ % (
                bytesToMegaBytes(len(self.pdf.content)),
                bytesToMegaBytes(pdfFileSizeLimit),
                "%s&download=true" % self.pdfURL,
                "%s&download=false" % self.pdfURL
            )
        
        if self.feature_template.email_body is not None:
            # Replace new lines with <br>
            self.feature_template.email_body = str(self.feature_template.email_body).replace("\r", "<br><br>").replace("\n", "<br><br>")
            # add the custom message part
            custom_message_part = """
                <strong>Custom message:</strong><br>
                %s<br><br>
                """ % str(self.feature_template.email_body)
            
        # Get failed steps information
        failed_steps_section = self._get_failed_steps_for_email()
        
        # Build feature URL for frontend
        feature_url = f"https://{DOMAIN}/#/{self.feature_result.department_name}/{self.feature_result.app_name}/{self.feature_result.feature_id.feature_id}"

        email_body = """
            Dear user!<br><br>
            Below you can find the information about the feature result.<br><br>
 
            <table border="0px">
                <tr><td><strong>Feature ID:</strong></td><td>%d</td></tr>
                <tr><td><strong>Summary:</strong></td><td>%d total steps, %d OK steps, %d failed/skipped steps</td></tr>
                <tr><td><strong>Department:</strong></td><td>%s</td></tr>
                <tr><td><strong>App:</strong></td><td>%s</td></tr>
                <tr><td><strong>Environment:</strong></td><td>%s</td></tr>
                <tr><td><strong>Test:</strong></td><td>%s</td></tr>
                <tr><td><strong>Feature URL:</strong></td><td><a href="%s">Open in Co.meta</a></td></tr>
                <tr><td><strong>Date + Time:<br><br><br></strong></td>
                            <td>
                                %s
                            </td>
                </tr>
                <tr><td><strong>Pixel Difference:</strong></td><td>%s</td></tr>
            </table>
            %s
            $[[[CUSTOM_EMAIL_DATA]]]
            %s
            <br><p>
            ----<br>
            Thank you for using co.meta<br><br>
            <br><br>
        """ % (
            self.feature_result.feature_id.feature_id,
            self.feature_result.total,
            self.feature_result.ok,
            self.totalnok,
            self.feature_result.department_name,
            self.feature_result.app_name,
            self.feature_result.environment_name,
            self.feature_result.feature_name,
            feature_url,
            utc_date if browser_date == "" else f"{utc_date}<br>{browser_date}",
            str(self.feature_result.pixel_diff),
            failed_steps_section,
            pdf_email_part
        )
        # Replace variables of feature
        email_body = self.replaceFeatureVariables(email_body)
        return email_body

    """
        Get the generated PDF, and all the subject and emailbody data.
        Then, using EmailMessage we build an email message and attach the PDF into it.
        Then, we send the email using the email backend server we configured on settings.py
    """
    def SendEmail(self):
        
        # EmailMessage object creation. More info about this class on https://docs.djangoproject.com/en/3.0/topics/email/#emailmessage-objects
        email = EmailMultiAlternatives(
            self.subject,
            '',
            from_email=settings.DEFAULT_FROM_EMAIL,
            to=self.feature_template.email_address,
            cc=self.feature_template.email_cc_address,
            bcc=self.feature_template.email_bcc_address,
            headers={'X-COMETA': 'proudly_generated_by_amvara_cometa', 'X-COMETA-SERVER': 'AMVARA', 'X-COMETA-VERSION': str(version), 'X-COMETA-FEATURE': self.feature_result.feature_name, 'X-COMETA-DEPARTMENT':self.feature_result.department_name}
        )
        # self.feature
        if self.feature_template.email_body:
            # $[[[CUSTOM_EMAIL_DATA]]]
            custom_email_body, email = self.process_custom_body_for_screenshots(email)
            if self.feature_template.do_not_use_default_template:
                self.emailbody = custom_email_body    
            else:
                # Attach custom_email_body with default template
                self.emailbody = self.emailbody.replace("$[[[CUSTOM_EMAIL_DATA]]]", custom_email_body)
        else:
            # If custom_email_body not found, then remove [[[CUSTOM_EMAIL_DATA]]] from default template
            self.emailbody = self.emailbody.replace("$[[[CUSTOM_EMAIL_DATA]]]", "")

        email.attach_alternative(self.emailbody, "text/html")
        if len(self.pdf.content) < pdfFileSizeLimit and self.feature_template.attach_pdf_report_to_email:
            # Attach the PDF generated PDF to the email. We give it a custom name before.
            email.attach(str(self.feature_result.feature_name)+'-'+str(self.feature_result.result_date)+'.pdf', self.pdf.content, 'application/pdf')
        # Send mail using the SMTP backend, and email settings set in settings.py.
        try:
            email.send()
            self.my_logger.debug("[GeneratePDF] "+str(self.feature_result.feature_id)+" | Email sent. Additional info: ")
            self.my_logger.debug("[GeneratePDF] "+str(self.feature_result.feature_id)+" | Sent to mail: "+ str(self.feature.email_address))
            self.my_logger.debug("[GeneratePDF] "+str(self.feature_result.feature_id)+" | Sent to CC mail: "+ str(self.feature.email_cc_address))
            self.my_logger.debug("[GeneratePDF] "+str(self.feature_result.feature_id)+" | Sent to BCC mail: "+ str(self.feature.email_bcc_address))
            self.my_logger.debug("[GeneratePDF] "+str(self.feature_result.feature_id)+" | Subject: "+ str(self.subject))
            self.my_logger.debug("[GeneratePDF] "+str(self.feature_result.feature_id)+" | Sent by email account: "+ str(settings.EMAIL_HOST_USER))
            # return HttpResponse("200 OK")
        except Exception as e:
            self.my_logger.critical("[GeneratePDF] "+str(self.feature_result.feature_id)+" | Error while sending the email. Error stack trace: ", e)
            raise Exception("Error while sending email")





class GeneratePDF(View, PDFAndEmailManager):
    """This functions generates a PDF using a feature result, including images, browser, etc...
    It creates a HTML file from generatePDF.html that then converts and exports to PDF.
    Then, the PDF is sent by mail using the backend email settings (settings.py).
    More info on: https://redmine.amvara.de/projects/cometa/wiki#Feature-Results-Reporting-in-PDF
    Requires library: xhtml2pdf. Is in requirements.txt and gets installed with "docker-compose up -d"

    Parameters:
    request (HTTPRequest): GET request containing feature_result_id, from Feature_Results model.

    Returns:
    HTTPResponse: 200 if everything ok, 503 if something went wrong.

    CHANGELOG:
    2021-06-24 RRO - update logger assignment to not emit multiple logs with same message
    2020-06-22 PEH - Big refactoring.
    2020-06-18 PEH - Last changes and code review
    2020-07-28 ABP - Add download parameter and behavior

    """    
    
      # Initialization. This is the main function, this executes all the class. We get here from URL /pdf/.
    # All of the steps are functions from this class. Each function has information about it before being declared.
    # FIXME 
    def get(self, request):
        return self.prepare_the_get(request)