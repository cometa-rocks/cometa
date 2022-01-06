
# Provides a class for logging into console
class LogCommand():
    # Log custom messages
    def log(self, text, **kwargs):
        log_type = kwargs.get('type', 'normal')
        if log_type == 'error':
            print(self.style.ERROR(text))
            self.stdout.write(self.style.ERROR(text))
        elif log_type == 'warning':
            print(self.style.WARNING(text))
            self.stdout.write(self.style.WARNING(text))
        elif log_type == 'success':
            print(self.style.SUCCESS(text))
            self.stdout.write(self.style.SUCCESS(text))
        else:
            print(text)
            self.stdout.write(text)

        # print() is used to save logs into Database Logging
        # self.stdout.write() is used to write into console when executing manually