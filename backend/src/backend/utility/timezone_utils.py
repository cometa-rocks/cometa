import datetime
import pytz
from crontab import CronTab
import logging

logger = logging.getLogger(__name__)

def convert_cron_to_utc(cron_expression: str, user_timezone_str: str) -> str | None:
    """
    Convert a cron expression's time components (hour, minute) from user's timezone to UTC.
    Uses the current day in the user's specified timezone as a reference for resolving DST.
    
    Handles both simple times and complex patterns:
    - Simple times (e.g., "0 14 * * *"): Converts hour/minute to UTC
    - Mixed patterns (e.g., "*/1 3 * * *"): Converts specific hour to UTC, preserves minute pattern
    - Full patterns (e.g., "*/5 * * * *"): Returns original (no specific time reference)
    
    Args:
        cron_expression: The 5-part cron string (e.g., "0 13 * * *").
        user_timezone_str: The name of the user's timezone (e.g., "America/New_York").

    Returns:
        The UTC cron expression string if conversion is successful.
        The original cron expression for patterns with no specific time reference.
        None if conversion is not possible (e.g., invalid timezone, non-existent local time due to DST).
    """
    try:
        parts = cron_expression.strip().split()
        if len(parts) != 5:
            logger.warning(f"Invalid cron expression format: '{cron_expression}'.")
            return None
        
        minute_str, hour_str, day_month_str, month_str, weekday_str = parts
        
        # Check if fields are simple numbers
        def is_simple_number(field_str):
            return field_str.isdigit()
        
        def has_patterns(field_str):
            return ('*' in field_str or '/' in field_str or '-' in field_str or ',' in field_str)
        
        minute_is_simple = is_simple_number(minute_str)
        hour_is_simple = is_simple_number(hour_str)
        
        # If both hour and minute have patterns, no specific time reference to convert
        if has_patterns(hour_str) and has_patterns(minute_str):
            logger.info(f"Cron with patterns in both hour and minute - returning original: '{cron_expression}'.")
            return cron_expression
        
        # Validate timezone
        try:
            user_tz = pytz.timezone(user_timezone_str)
        except pytz.exceptions.UnknownTimeZoneError:
            logger.error(f"Unknown timezone: '{user_timezone_str}' for cron '{cron_expression}'.")
            return None

        utc_tz = pytz.UTC
        now_in_user_tz = datetime.datetime.now(user_tz)
        
        # Handle different scenarios
        if hour_is_simple and minute_is_simple:
            # Both are simple numbers - standard conversion
            return _convert_simple_time_to_utc(
                int(minute_str), int(hour_str), user_tz, utc_tz, now_in_user_tz,
                day_month_str, month_str, weekday_str, cron_expression, user_timezone_str
            )
        
        elif hour_is_simple and has_patterns(minute_str):
            # Hour is specific, minute has patterns (e.g., "*/1 3 * * *")
            return _convert_hour_preserve_minute_pattern(
                minute_str, int(hour_str), user_tz, utc_tz, now_in_user_tz,
                day_month_str, month_str, weekday_str, cron_expression, user_timezone_str
            )
        
        elif has_patterns(hour_str) and minute_is_simple:
            # Minute is specific, hour has patterns (e.g., "30 */2 * * *")
            logger.info(f"Hour patterns with specific minute not fully supported - returning original: '{cron_expression}'.")
            return cron_expression
        
        else:
            logger.warning(f"Unexpected cron pattern: '{cron_expression}'.")
            return cron_expression
            
    except Exception as e:
        logger.error(
            f"Unexpected error converting cron '{cron_expression}' to UTC "
            f"for timezone '{user_timezone_str}': {e}", exc_info=True
        )
        return None

def _convert_simple_time_to_utc(minute_val, hour_val, user_tz, utc_tz, now_in_user_tz,
                               day_month_str, month_str, weekday_str, cron_expression, user_timezone_str):
    """Convert simple hour:minute to UTC"""
    try:
        naive_user_dt = datetime.datetime(
            now_in_user_tz.year, now_in_user_tz.month, now_in_user_tz.day, 
            hour_val, minute_val
        )
        
        try:
            localized_user_dt = user_tz.localize(naive_user_dt, is_dst=None)
        except pytz.exceptions.NonExistentTimeError:
            logger.warning(
                f"Local time {hour_val}:{minute_val:02d} does not exist in {user_timezone_str} "
                f"on {now_in_user_tz.date()} due to DST (spring forward). Cron: '{cron_expression}'."
            )
            return None
        except pytz.exceptions.AmbiguousTimeError:
            localized_user_dt = user_tz.localize(naive_user_dt, is_dst=False)
            logger.warning(
                f"Local time {hour_val}:{minute_val:02d} is ambiguous in {user_timezone_str} "
                f"on {now_in_user_tz.date()} due to DST (fall back). Using standard time."
            )
        
        utc_dt = localized_user_dt.astimezone(utc_tz)
        utc_cron = f"{utc_dt.minute} {utc_dt.hour} {day_month_str} {month_str} {weekday_str}"
        
        logger.info(
            f"Converted cron from '{cron_expression}' ({user_timezone_str}) to '{utc_cron}' (UTC)"
        )
        return utc_cron
        
    except ValueError as e:
        logger.error(f"Invalid hour/minute value in cron: '{cron_expression}': {e}")
        return None

def _convert_hour_preserve_minute_pattern(minute_pattern, hour_val, user_tz, utc_tz, now_in_user_tz,
                                        day_month_str, month_str, weekday_str, cron_expression, user_timezone_str):
    """Convert specific hour to UTC while preserving minute pattern (e.g., */1 3 * * *)"""
    try:
        # Use minute 0 as reference for the hour conversion
        naive_user_dt = datetime.datetime(
            now_in_user_tz.year, now_in_user_tz.month, now_in_user_tz.day, 
            hour_val, 0
        )
        
        try:
            localized_user_dt = user_tz.localize(naive_user_dt, is_dst=None)
        except pytz.exceptions.NonExistentTimeError:
            logger.warning(
                f"Local time {hour_val}:00 does not exist in {user_timezone_str} "
                f"on {now_in_user_tz.date()} due to DST (spring forward). Cron: '{cron_expression}'."
            )
            return None
        except pytz.exceptions.AmbiguousTimeError:
            localized_user_dt = user_tz.localize(naive_user_dt, is_dst=False)
            logger.warning(
                f"Local time {hour_val}:00 is ambiguous in {user_timezone_str} "
                f"on {now_in_user_tz.date()} due to DST (fall back). Using standard time."
            )
        
        utc_dt = localized_user_dt.astimezone(utc_tz)
        utc_cron = f"{minute_pattern} {utc_dt.hour} {day_month_str} {month_str} {weekday_str}"
        
        logger.info(
            f"Converted cron hour from '{cron_expression}' ({user_timezone_str}) to '{utc_cron}' (UTC), preserving minute pattern"
        )
        return utc_cron
        
    except ValueError as e:
        logger.error(f"Invalid hour value in cron: '{cron_expression}': {e}")
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