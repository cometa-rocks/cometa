import datetime
import pytz
from crontab import CronTab
import logging

logger = logging.getLogger(__name__)

def convert_cron_to_utc(cron_expression: str, user_timezone_str: str) -> str | None:
    """
    Convert a cron expression's time components (hour, minute) from user's timezone to UTC.
    Uses the current day in the user's specified timezone as a reference for resolving DST.
    
    Args:
        cron_expression: The 5-part cron string (e.g., "0 13 * * *").
        user_timezone_str: The name of the user's timezone (e.g., "America/New_York").

    Returns:
        The UTC cron expression string if conversion is successful.
        None if conversion is not possible (e.g., wildcard hour/minute, 
        invalid timezone, non-existent local time due to DST).
    """
    try:
        parts = cron_expression.strip().split()
        if len(parts) != 5:
            logger.warning(f"Invalid cron expression format: '{cron_expression}'.")
            return None
        
        minute_str, hour_str, day_month_str, month_str, weekday_str = parts
        
        if hour_str == '*' or minute_str == '*':
            logger.info(f"Cron with wildcard hour/minute cannot be timezone-converted: '{cron_expression}'.")
            return None # Keep original if wildcards are used for H:M

        try:
            user_tz = pytz.timezone(user_timezone_str)
        except pytz.exceptions.UnknownTimeZoneError:
            logger.error(f"Unknown timezone: '{user_timezone_str}' for cron '{cron_expression}'.")
            return None

        utc_tz = pytz.UTC
        
        # Get current date context in the user's specified timezone
        # This is crucial for determining the correct DST offset for "today"
        now_in_user_tz = datetime.datetime.now(user_tz)
        
        hour_val = int(hour_str)
        minute_val = int(minute_str)
        
        # Create a naive datetime for the specified hour/minute on "today"
        # This naive datetime will be localized to the user's timezone
        naive_user_dt_on_ref_day = datetime.datetime(
            now_in_user_tz.year, 
            now_in_user_tz.month, 
            now_in_user_tz.day, 
            hour_val, 
            minute_val
        )

        try:
            # Localize the naive datetime.
            # For ambiguous times (fall back), pytz defaults to is_dst=False (standard time, usually the second instance).
            # For non-existent times (spring forward), it raises NonExistentTimeError.
            localized_user_dt = user_tz.localize(naive_user_dt_on_ref_day, is_dst=None)
        except pytz.exceptions.NonExistentTimeError:
            logger.warning(
                f"Local time {hour_str}:{minute_str} does not exist in {user_timezone_str} "
                f"on {now_in_user_tz.date()} due to DST (spring forward). Cron: '{cron_expression}'."
            )
            return None # Indicates this local time is currently invalid
        except pytz.exceptions.AmbiguousTimeError:
            # Explicitly choose the standard time instance (is_dst=False), which is pytz's default for is_dst=None.
            # This is typically the second occurrence of the ambiguous hour.
            localized_user_dt = user_tz.localize(naive_user_dt_on_ref_day, is_dst=False)
            logger.warning(
                f"Local time {hour_str}:{minute_str} is ambiguous in {user_timezone_str} "
                f"on {now_in_user_tz.date()} due to DST (fall back). Cron: '{cron_expression}'. "
                f"Defaulting to standard time instance (UTC hour: {localized_user_dt.astimezone(utc_tz).hour})."
            )
        
        utc_dt = localized_user_dt.astimezone(utc_tz)
        
        utc_cron_parts = [str(utc_dt.minute), str(utc_dt.hour), day_month_str, month_str, weekday_str]
        utc_cron = " ".join(utc_cron_parts)
        
        # Log only if a meaningful conversion happened (i.e., input wasn't already effectively UTC for H:M)
        # or if it's different from the original due to timezone offset.
        original_hm = f"{minute_str} {hour_str}"
        utc_hm = f"{utc_dt.minute} {utc_dt.hour}"
        if original_hm != utc_hm or user_timezone_str.upper() not in ["UTC", "GMT", "ETC/UTC", "ETC/GMT"]:
             logger.info(
                 f"Converted cron from '{cron_expression}' ({user_timezone_str}) to '{utc_cron}' (UTC) "
                 f"using reference date {now_in_user_tz.date()}."
            )
        return utc_cron
        
    except ValueError: # Catches int(hour_str) or int(minute_str) if they are not numbers
        logger.error(f"Invalid hour/minute value in cron: '{cron_expression}'.")
        return None
    except Exception as e:
        logger.error(
            f"Unexpected error converting cron '{cron_expression}' to UTC "
            f"for timezone '{user_timezone_str}': {e}", exc_info=True
        )
        return None

def recalculate_schedule_if_needed(schedule) -> bool:
    """
    Check if a schedule's stored UTC cron needs DST recalculation and update it if needed.
    Compares the current UTC conversion of the original_cron against the stored schedule.
    Returns True if an update was made, False otherwise.
    """
    try:
        if not schedule.original_timezone or not schedule.original_cron:
            # Not enough info to recalculate
            return False
        
        # Calculate what the UTC cron *should* be based on current DST rules for the original local time
        newly_calculated_utc_cron = convert_cron_to_utc(schedule.original_cron, schedule.original_timezone)
        
        if newly_calculated_utc_cron is None:
            # This means the original_cron currently specifies a non-existent local time (e.g., 2:30 AM during spring forward).
            # We should not modify schedule.schedule in this case. The existing UTC schedule will be used.
            # If the local time becomes valid again, a future call to this function will correct it.
            logger.warning(
                f"For schedule ID {schedule.id} (original: '{schedule.original_cron}' @ {schedule.original_timezone}), "
                f"the local time is currently invalid. Stored UTC schedule '{schedule.schedule}' will not be updated at this time."
            )
            return False 
            
        if newly_calculated_utc_cron != schedule.schedule:
            logger.info(
                f"Schedule ID {schedule.id} needs DST update. "
                f"Old UTC: '{schedule.schedule}', New UTC: '{newly_calculated_utc_cron}' "
                f"(from original: '{schedule.original_cron}' @ {schedule.original_timezone})."
            )
            schedule.schedule = newly_calculated_utc_cron
            try:
                schedule.save() # Assumes 'schedule' is a Django model instance
                return True
            except Exception as e:
                logger.error(f"Error saving updated schedule {schedule.id} after DST recalculation: {e}", exc_info=True)
                # If save fails, the in-memory 'schedule.schedule' is changed but not persisted.
                return False # Update failed to save
            
        return False
        
    except Exception as e:
        logger.error(f"Error recalculating schedule for ID {getattr(schedule, 'id', 'UNKNOWN')}: {e}", exc_info=True)
        return False 