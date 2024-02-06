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
import sys
from os.path import isfile, exists
sys.path.append("/code")
import secret_variables
import pytz
# Python basics
import logging
import logging.handlers
import datetime

# logger information
logger = getLogger()

DOMAIN = getattr(secret_variables, 'COMETA_DOMAIN', '')
SCREENSHOT_PREFIX = getattr(secret_variables, 'COMETA_SCREENSHOT_PREFIX', '')


class GeneratePDF(View):
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
    def get(self, request):
        # Get the request
        self.request = request

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
        self.feature = self.GetFeature()

        # save the pdf download path
        self.downloadPath = "/code/behave/pdf"
        self.downloadFullPath = "%s/%s-%s.pdf" % (self.downloadPath, str(self.feature.feature_name), str(self.feature_result_id))


        # check if download path exists
        if not exists(self.downloadPath):
            self.my_logger.debug("Download path does not exists .... creating one...")
            os.makedirs(self.downloadPath)

        # check if lock file exists if so that mean the pdf file is being generate
        if exists(self.downloadFullPath + ".lock"):
            return HttpResponse("PDF File for Feature: %s and Feature Result ID: %s is still being generated, please try again later." % (str(self.feature.feature_name), str(self.feature_result_id)))

        # generate pdf url
        self.pdfURL = "https://%s/backend/pdf/?feature_result_id=%s" % (DOMAIN, self.feature_result_id)

        # Assigning class variables to use in all the functions.
        self.feature_template = self.feature.feature_id
        self.feature_id = self.feature.feature_id_id

        # If the request GET parameter "download" is present, download the PDF instead of emailing it to it's recipient
        download = self.request.GET.get('download', None)

        
        # check if file already exists
        if not exists(self.downloadFullPath):
            self.my_logger.debug("Creating a lock file for %s" % self.downloadFullPath)
            # create a lock file to check if pdf is still being generated or not
            self.touch(self.downloadFullPath + ".lock")

            # Get the steps from the executed feature.
            steps = Step_result.objects.filter(feature_result_id=self.feature_result_id).order_by("step_result_id")
            self.steps = steps

            # Get the feature result screenshots.
            self.screenshots_array = self.GetStepsAndScreenshots()

            # Calculate percentatge of OK steps and NOK steps
            try:
                self.percentok = int((self.feature.ok * 100) / self.feature.total)
            except ZeroDivisionError:
                self.percentok = 0
            try:
                self.percentnok = int(((self.feature.fails + self.feature.skipped) * 100) / self.feature.total)
            except ZeroDivisionError:
                self.percentnok = 0
            self.totalnok = int(self.feature.fails) + int(self.feature.skipped)

            # Build the HTML and then render it into a PDF.
            self.pdf = self.BuildHtmlAndRenderPdf()

            
            # save the pdf to file
            with open(self.downloadFullPath, 'wb') as f:
                f.write(self.pdf.content)
            
            # remove lock file once finished
            if exists(self.downloadFullPath + ".lock"):
                self.my_logger.debug("Removing lock file for %s" % self.downloadFullPath)
                os.remove(self.downloadFullPath + ".lock")

  
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
            response['Content-Disposition'] = 'attachment; filename="%s-%s.pdf"' % (str(self.feature.feature_name), str(self.feature.result_date))
            response['Content-Length'] = len(PDFContent)
            return response
        elif download == 'false':
            # Send response with PDF preview
            response = HttpResponse(PDFContent, content_type='application/pdf')
            response['Content-Disposition'] = 'inline; filename="%s-%s.pdf"' % (str(self.feature.feature_name), str(self.feature.result_date))
            response['Content-Length'] = len(PDFContent)
            return response
        else:
            # Build the subject and the emailbody.
            self.subject = self.BuildEmailSubject()
            self.emailbody = self.BuildEmailBody()

            # Send the email.
            self.SendEmail()
        
        
        # Finish
        return HttpResponse("200")

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
    def GetFeature(self):
        try:
            feature = Feature_result.objects.get(feature_result_id=self.feature_result_id)
        except Feature_result.DoesNotExist:
            # If the feature is not found then we return error, if not get item
            self.my_logger.critical('[GeneratePDF] Error while retrieving feature info: Feature not found.')
            raise ValueError("503 Feature not found")
        
        if isinstance(feature.browser, str):
            feature.browser = json.loads(feature.browser)
        return feature

    """
     Email valiadation. We get all the emails, run them into django validator and remove the invalid ones.
     Also, if there send email is set to false, get out of the function.
    """
    def ValidateEmails(self):
        
        # If the email does not need to get sent, get out...
        if(self.feature_template.send_mail == False):
            self.my_logger.debug("[GeneratePDF] "+str(self.feature.feature_id)+" | Send email is set to False. No email sent.")
            return False

        # Check if the email is send on error only. If it is, check feature errors. If there is no errors, get out of execution and don't send email.
        if(self.feature_template.send_mail_on_error == True):
            self.my_logger.debug("[GeneratePDF] "+str(self.feature.feature_id)+" | Send email is set to Send On Error.")
            if(self.feature.fails <= 0):
                self.my_logger.debug("[GeneratePDF] "+str(self.feature.feature_id)+" | No errors. Email not sent.")
                return False
            else:
                self.my_logger.debug("[GeneratePDF] "+str(self.feature.feature_id)+" | Errors found. Will send email.")

        # Bad e-mail checking. If an email is not valid, it will get deleted. This is done to protect user from sending emails to unwanted directions.
        bad_emails = []
        for email in self.feature_template.email_address or []:
            try:
                validate_email(email)
                self.my_logger.debug("[GeneratePDF] "+str(self.feature.feature_id)+" | Valid e-mail ("+email+")")
            except ValidationError as e:
                bad_emails.append(email)
                self.my_logger.debug("[GeneratePDF] "+str(self.feature.feature_id)+" | Invalid e-mail. Removed from list.")
            
        # We remove them here as it is a bad pactice to remove items for the list we are iterating on.
        for bad_email in bad_emails:
            self.feature_template.email_address.remove(bad_email)
        # If all emails are removed then dont proceed
        if len(self.feature_template.email_address) == 0:
            self.my_logger.debug("[GeneratePDF] "+str(self.feature.feature_id)+" | All e-mails were invalid and they were not sent. Exiting.")
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
            # Count to enumerate steps, as django templates language cannot modify variables
            step.count = count
            count = count + 1
            # Trim the step name to get a maximum of 60 characters
            if len(step.step_name) > 57:
                step.step_name = step.step_name[:57] + '...'
            # Iterate over each screenshot
            fields = ['current', 'style', 'difference']
            for field in fields:
                # Construct image path
                path = settings.SCREENSHOTS_ROOT + getattr(step, 'screenshot_' + field, '')
                # Check file in database exists
                if isfile(path):
                    # Open image and convert to base64
                    with open(path, "rb") as file:
                        photo = base64.b64encode(file.read())
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
                            photo = base64.b64encode(file.read())
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
        browserinfo = self.feature.browser['browser']+" "+str(self.feature.browser['browser_version'])
        domain = 'https://%s' % DOMAIN
        # Send the context to the template. The context in this case is a dictionary containing variables with value to use in the template.
        date_time = self.feature.result_date.replace(tzinfo=ZoneInfo('UTC'))
        utc_date =  date_time.astimezone(pytz.timezone('UTC')).strftime('%Y-%m-%d %H:%M:%S %Z')
        cet_date =  date_time.astimezone(pytz.timezone('Europe/Berlin')).strftime('%Y-%m-%d %H:%M:%S %Z')
        ist_date =  date_time.astimezone(pytz.timezone('Asia/Kolkata')).strftime('%Y-%m-%d %H:%M:%S %Z')
        
        context = {
            "invoice_id": self.feature.feature_name,
            "utc_date": utc_date,
            "cet_date": cet_date,
            "ist_date": ist_date,
            "stepsarray": self.steps,
            "domain": domain,
            "featureinfo": self.feature,
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
            return pdf
        except Exception as e:
            self.my_logger.critical("[GeneratePDF] "+str(self.feature.feature_id)+" | Error while rendering the PDF. Error stack trace: ", e)
            raise ValueError("Error while rendering the PDF")

    """
        Replaces the feature variables for the given text
    """
    def replaceFeatureVariables(self, text):
        # Transform feature object to dict
        info = model_to_dict(self.feature)
        # Provide some custom keys
        info['status'] = 'PASSED' if info['success'] else 'FAILED'
        # Iterate over each property
        for key in info:
            # Filter by allowed key type
            if isinstance(info[key], (int, str, datetime.datetime, bool)):
                # Replace new lines with <br>
                variable_text = '<br />'.join(str(info[key]).splitlines())
                # Replace variable value with key
                text = text.replace("$%s" % str(key), str(variable_text))
        return text

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
                self.feature.feature_name[:emailSubjectFeatureNameLimit],
                "..." if len(self.feature.feature_name) > emailSubjectFeatureNameLimit else '',
                self.feature.ok,
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
    def BuildEmailBody(self):
        date_time = self.feature.result_date.replace(tzinfo=ZoneInfo('UTC'))
        utc_date =  date_time.astimezone(pytz.timezone('UTC')).strftime('%Y-%m-%d %H:%M:%S %Z')
        cet_date =  date_time.astimezone(pytz.timezone('Europe/Berlin')).strftime('%Y-%m-%d %H:%M:%S %Z')
        ist_date =  date_time.astimezone(pytz.timezone('Asia/Kolkata')).strftime('%Y-%m-%d %H:%M:%S %Z')

        email_body = """
            Dear user!<br><br>
            Below you can find the information about the feature result.<br><br>

            <ul>
                <li><strong>Feature ID:</strong> %d</li>
                <li><strong>Summary:</strong> %d total steps, %d OK steps, %d failed/skipped steps</li>
                <li><strong>Department:</strong> %s</li>
                <li><strong>App:</strong> %s</li>
                <li><strong>Environment:</strong> %s</li>
                <li><strong>Test:</strong> %s</li>
                <li style="padding-top:3px">
                    <table border=0px style="padding:0; margin-left:-3px; "><tr>
                        <td><strong style="float:left;">Date + Time:</strong> </td>
                        <td>%s</td>
                        </tr>
                        <tr>
                            <td></td>
                        <td>%s</td>
                        </tr>
                        <tr>
                            <td></td>      
                        <td>%s</td>
                        </tr>
                    </table>
                </li>


                <li><strong>Pixel Difference:</strong> %s</li>
            </ul><br><br>
            %s
            %s
            Thanks you for using co.meta<br><br>
            Best regards<br><br>
        """ % (
            self.feature.feature_id.feature_id,
            self.feature.total,
            self.feature.ok,
            self.totalnok,
            self.feature.department_name,
            self.feature.app_name,
            self.feature.environment_name,
            self.feature.feature_name,
            utc_date,
            cet_date,
            ist_date,
            str(self.feature.pixel_diff),
            "" if self.feature_template.email_body == None else """
            <strong>Custom message:</strong><br>
            %s<br><br>
            """ % str(self.feature_template.email_body),
            "" if len(self.pdf.content) < pdfFileSizeLimit else """
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
            settings.EMAIL_HOST_USER,
            to=self.feature_template.email_address,
            headers={'X-COMETA': 'proudly_generated_by_amvara_cometa', 'X-COMETA-SERVER': 'AMVARA', 'X-COMETA-VERSION': str(version), 'X-COMETA-FEATURE': self.feature.feature_name, 'X-COMETA-DEPARTMENT':self.feature.department_name}
        )
        email.attach_alternative(self.emailbody, "text/html")
        if len(self.pdf.content) < pdfFileSizeLimit:
            # Attach the PDF generated PDF to the email. We give it a custom name before.
            email.attach(str(self.feature.feature_name)+'-'+str(self.feature.result_date)+'.pdf', self.pdf.content, 'application/pdf')
        # Send mail using the SMTP backend, and email settings set in settings.py.
        try:
            email.send()
            self.my_logger.debug("[GeneratePDF] "+str(self.feature.feature_id)+" | Email sent. Additional info:  ")
            self.my_logger.debug("[GeneratePDF] "+str(self.feature.feature_id)+" | Sent to (next line):  ")
            self.my_logger.debug(self.feature_template.email_address)
            self.my_logger.debug("[GeneratePDF] "+str(self.feature.feature_id)+" | Subject: "+ str(self.subject))
            self.my_logger.debug("[GeneratePDF] "+str(self.feature.feature_id)+" | Sent by email account: "+ str(settings.EMAIL_HOST_USER))
            # return HttpResponse("200 OK")
        except Exception as e:
            self.my_logger.critical("[GeneratePDF] "+str(self.feature.feature_id)+" | Error while sending the email. Error stack trace: ", e)
            raise ValueError("Error while sending email")
