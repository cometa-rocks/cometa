from django import template
from backend.common import *
import os
register = template.Library()

@register.filter
def Humanize(milliseconds):
    milliseconds = int(milliseconds)
    if milliseconds < 1000:
        return "%dms" % milliseconds
    seconds = int((milliseconds / 1000) % 60)
    minutes = int((milliseconds / (1000 * 60)) % 60)
    hours = int((milliseconds / (1000 * 60 * 60)) % 24)
    hDisplay = (str(hours) + 'h' if hours > 0 else '') + (':' if minutes > 0 and hours > 0 else '')
    mDisplay = (str(minutes) + 'm' if minutes > 0 else '') + (':' if seconds > 0 and minutes > 0 else '')
    sDisplay = str(seconds) + 's' if seconds > 0 else ''
    return hDisplay + mDisplay + sDisplay

@register.filter
def NormalizeDownloadName(path):
    filename = path.split('/')[1]
    filename, extension = os.path.splitext(filename)
    if len(filename) > pdfDownloadNameLimit:
        filename = filename[:pdfDownloadNameLimit] + '(...)'
    return filename + extension

@register.filter
def FormatNumber(number):
    return '{:,}'.format(number)