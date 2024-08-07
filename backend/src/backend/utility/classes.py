import sys

# Provides a class for logging into console
from datetime import datetime


class Style:
    @staticmethod
    def ERROR(text):
        return f"\033[91m{text}\033[0m"  # Red text for errors

    @staticmethod
    def NORMAL(text):
        return text

    @staticmethod
    def SUCCESS(text):
        return f"\033[92m{text}\033[0m"  # Green text for success

    @staticmethod
    def WARNING(text):
        return f"\033[93m{text}\033[0m"  # Yellow text for warnings


class LogCommand:
    def __init__(self):
        self.__logs = []
        self.style = Style()
        pass

    def style(self, text, style_type="normal"):
        styles = {
            "normal": text,
            "error": f"\033[91m{text}\033[0m",  # Red text for errors
        }
        return styles.get(style_type, text)

    # Log custom messages
    def log(self, text, spacing=0, **kwargs):

        log_type = kwargs.get("type", "normal")
        formatted_date = datetime.now().strftime("[%d/%b/%Y %H:%M:%S]")
        self.__logs.append(
            {
                "type": log_type,
                "value": text,
                "spacing": spacing,
                "formatted_date": formatted_date,
            }
        )

        text = "\t" * spacing + text + "\n"

        if log_type == "error":
            # print(self.style.ERROR(text))
            sys.stdout.write(self.style.ERROR(text))
        elif log_type == "warning":
            # print(self.style.WARNING(text))
            sys.stdout.write(self.style.WARNING(text))
        elif log_type == "success":
            # print(self.style.SUCCESS(text))
            sys.stdout.write(self.style.SUCCESS(text))
        else:
            # print(text)
            sys.stdout.write(text)

    def get_logs(self):
        return self.__logs

        # print() is used to save logs into Database Logging
        # self.stdout.write() is used to write into console when executing manually
