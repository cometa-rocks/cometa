import logging

class ColoredFormatter(logging.Formatter):
    # ANSI color codes
    COLORS = {
        'ERROR': '\033[91m',     # Red
        'CRITICAL': '\033[91m',  # Red
        'WARNING': '\033[93m',   # Yellow
        'INFO': '\033[96m',      # Cyan (blue)
        'DEBUG': '\033[96m',     # Cyan (blue)
        'RESET': '\033[0m'       # Reset color
    }
    
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.datefmt = '%Y-%m-%d %H:%M:%S'
    
    def format(self, record):
        # Get the color for this log level
        color = self.COLORS.get(record.levelname, self.COLORS['INFO'])
        reset = self.COLORS['RESET']
        
        # Format the structured part in the appropriate color
        formatted = f"{color}[{self.formatTime(record, self.datefmt)}.{record.msecs:03.0f}][{record.threadName}][{record.levelname}][{record.filename}:{record.lineno}]({record.funcName}) -{reset} {record.getMessage()}"
        
        return formatted