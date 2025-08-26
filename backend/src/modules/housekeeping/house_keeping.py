# author : Anand Kushwaha
# version : 10.0.13
# date : 2024-07-11

# CHANGELOG:
# 10.0.13:
# - Remove non-persistent retry logic entirely
# - Keep prior fixes: iterator+count split, safe path bounding, deepest→shallowest prune,
# - Feature PK in prune, robust mobile handling, __isnull in screenshot filter,
# - epoch-based log cleanup, lower noise on "already clean".

import os
import shutil
import time
import traceback
from threading import Thread
from datetime import timedelta

from django.core.management import call_command
from django.utils import timezone

from backend.models import Department, Feature_result, Step_result
from backend.utility.classes import LogCommand
from backend.utility.functions import getLogger
from modules.container_service.models import ContainerService

logger = getLogger()


class HouseKeepingThread(LogCommand, Thread):
    # container-internal mounts (bind/symlink on host as needed)
    screenshot_file_path = "/data/screenshots"
    video_directory_path = "/data/videos"
    pdf_report_file_path = "/code/behave/pdf"
    log_file_path = "/code/src/logs"

    def __init__(self, house_keeping_logs):
        Thread.__init__(self)
        LogCommand.__init__(self)
        self.house_keeping_logs = house_keeping_logs

    # ----------------------------
    # Django session maintenance
    # ----------------------------
    def clear_django_sessions(self):
        try:
            self.log("============================================")
            self.log("Starting Django sessions cleanup")
            self.log("============================================")
            call_command("clearsessions")
            self.log("Django clearsessions completed successfully")
            return True
        except Exception as e:
            self.log(f"Exception while clearing Django sessions: {e}", type="error", spacing=1)
            self.log(f"Traceback: {traceback.format_exc()}", type="error", spacing=2)
            return False

    def vacuum_postgres_django_sessions(self):
        try:
            self.log("============================================")
            self.log("Starting PostgreSQL VACUUM on django_session table")
            self.log("============================================")
            from django.db import connection
            with connection.cursor() as cursor:
                cursor.execute("VACUUM (ANALYZE) django_session;")
            self.log("PostgreSQL VACUUM completed successfully")
            return True
        except Exception as e:
            self.log(f"Exception vacuuming django_session: {e}")
            return False

    # ----------------------------
    # Path utils
    # ----------------------------
    def _bound_path(self, root: str, rel: str) -> str | None:
        """
        Join root + rel, normalize, and ensure result stays under root.
        Returns abs path or None if rel is empty or escapes root.
        """
        rel = (rel or "").strip()
        if not rel:
            return None
        root_abs = os.path.abspath(root)
        cand = os.path.abspath(os.path.join(root_abs, os.path.normpath(rel)))
        if not cand.startswith(root_abs + os.sep):
            self.log(f"Refusing to operate outside root: {cand}", type="warning")
            return None
        return cand

    # ----------------------------
    # Deletion helpers
    # ----------------------------
    def __delete_video_file_if_exists(self, result: Feature_result):
        names = []
        if getattr(result, "video_url", None) and result.video_url.strip():
            names.append(result.video_url.rsplit("/", 1)[-1])

        for mobile in (result.mobile or []):
            if isinstance(mobile, dict):
                url = (mobile.get("video_recording") or "").strip()
                if url:
                    names.append(url.rsplit("/", 1)[-1])

        if not names:
            return True

        ok = True
        for name in names:
            p = self._bound_path(self.video_directory_path, name)
            if not p:
                continue
            try:
                if os.path.isfile(p):
                    os.remove(p)
                    self.log(f"{p} file deleted", spacing=3)
                else:
                    self.log(f"Video already clean: {p}", type="info", spacing=3)
            except Exception:
                ok = False
                self.log(f'Exception deleting video "{p}": {traceback.format_exc()}', type="error", spacing=3)
        return ok

    def __delete_pdf_file_if_exists(self, result: Feature_result):
        rel = (
            result.pdf_result_file_path.strip()
            if (result.pdf_result_file_path and result.pdf_result_file_path.strip())
            else f"{result.feature_id.feature_name}-{result.feature_result_id}.pdf"
        )
        p = self._bound_path(self.pdf_report_file_path, rel)
        if not p:
            return True
        try:
            if os.path.isfile(p):
                os.remove(p)
                self.log(f"{p} file deleted", spacing=3)
            else:
                self.log(f"PDF already clean: {p}", type="info", spacing=3)
            return True
        except Exception:
            self.log(f'Exception deleting PDF "{p}": {traceback.format_exc()}', type="error", spacing=3)
            return False

    def __delete_screenshot_parent_directories(self, screenshot_rel_path: str, feature_id_value):
        """
        Delete empty parent directories from the screenshot's directory
        up to (but not including) the <feature_id> directory.
        """
        if not screenshot_rel_path:
            return

        root_path = os.path.abspath(self.screenshot_file_path)
        abs_candidate = self._bound_path(self.screenshot_file_path, screenshot_rel_path)
        if not abs_candidate:
            return

        parts = os.path.normpath(screenshot_rel_path).split(os.sep)
        try:
            idx = parts.index(str(feature_id_value))
        except ValueError:
            self.log(f"Feature ID {feature_id_value} not in screenshot path {screenshot_rel_path}", type="warning", spacing=3)
            return

        # from deepest parent dir up to directory right after feature_id
        start = idx + 1
        end = len(parts) - 1  # exclude filename
        for i in range(end, start - 1, -1):
            cur_rel = os.path.join(*parts[:i])  # up to i-1
            cur_abs = self._bound_path(self.screenshot_file_path, cur_rel)
            if not cur_abs or cur_abs == root_path:
                break
            if os.path.isdir(cur_abs):
                try:
                    if not os.listdir(cur_abs):
                        os.rmdir(cur_abs)
                        self.log(f"Deleted empty directory: {cur_abs}", spacing=3)
                except Exception as e:
                    self.log(f"Error deleting directory {cur_abs}: {e}", type="warning", spacing=3)

    def __delete_screenshot_file_if_exists(self, step_result: Step_result, feature_result: Feature_result | None = None):
        rel = (getattr(step_result, "screenshot_current", None) or "").strip()
        if not rel:
            return True

        p = self._bound_path(self.screenshot_file_path, rel)
        if not p:
            return True

        try:
            if os.path.isfile(p):
                os.remove(p)
                self.log(f"{p} file deleted", spacing=3)
            else:
                self.log(f"Screenshot already clean: {rel}", type="info", spacing=3)

            if feature_result is not None:
                fid = getattr(feature_result, "feature_id_id", None) or getattr(feature_result.feature_id, "pk", None)
                if fid:
                    self.__delete_screenshot_parent_directories(rel, fid)
            return True
        except Exception:
            self.log(f'Exception deleting screenshot "{p}": {traceback.format_exc()}', type="error", spacing=3)
            return False

    # ----------------------------
    # Main cleaning routines
    # ----------------------------
    def filter_and_delete_files(self):
        deps = Department.objects.filter(settings__result_expire_days__gt=0)

        self.log("============================================")
        self.log(f"Found {deps.count()} departments with expire days configured")
        for department in deps:
            self.log(
                f"Department ID: {department.department_id}\t Name: {department.department_name},"
                f"\t Result Expire Days: {department.settings.get('result_expire_days')}",
                spacing=1,
            )
        self.log("============================================")
        self.log("\n")

        for department in deps:
            self.log(
                f"Cleaning files in department [ID: {department.department_id}] [NAME: {department.department_name}]",
                spacing=1,
            )

            cutoff_dt = timezone.now() - timedelta(days=department.settings["result_expire_days"])
            try:
                qs = (
                    Feature_result.objects
                    .filter(
                        department_id=department.department_id,
                        result_date__lt=cutoff_dt,
                        house_keeping_done=False,
                        archived=False,
                    )
                    .select_related("feature_id")
                    .order_by("result_date")
                )

                total_to_clean = qs.count()
                self.log(f"Found {total_to_clean} Feature_Result to clean", spacing=1)

                total_processed = 0
                successfully_cleaned = 0
                failed_cleanup = 0

                for feature_result in qs.iterator(chunk_size=1000):
                    total_processed += 1
                    self.log(
                        f"Cleaning Feature_Result [ID: {feature_result.feature_result_id}] "
                        f"[FeatureID: {feature_result.feature_id}]",
                        spacing=2,
                    )

                    video_clean = self.__delete_video_file_if_exists(feature_result)
                    pdf_clean = self.__delete_pdf_file_if_exists(feature_result)

                    step_qs = (
                        Step_result.objects
                        .filter(feature_result_id=feature_result.feature_result_id,
                                screenshot_current__isnull=False)
                        .exclude(screenshot_current="")
                    )
                    step_count = step_qs.count()
                    self.log(
                        f"Found {step_count} Step_result screenshots in Feature_Result "
                        f"[ID: {feature_result.feature_result_id}] to clean",
                        spacing=2,
                    )

                    screenshot_clean = True
                    for step_result in step_qs.iterator(chunk_size=2000):
                        if not self.__delete_screenshot_file_if_exists(step_result, feature_result):
                            screenshot_clean = False

                    self.log(f"Processed {step_count} screenshots", spacing=3)

                    if video_clean and pdf_clean and screenshot_clean:
                        feature_result.house_keeping_done = True
                        feature_result.save(update_fields=["house_keeping_done"])
                        successfully_cleaned += 1
                        self.log(
                            f"Feature_Result [ID: {feature_result.feature_result_id}] successfully cleaned",
                            spacing=2,
                        )
                    else:
                        failed_cleanup += 1
                        self.log(
                            f"Feature_Result [ID: {feature_result.feature_result_id}] not fully cleaned; will be retried next run",
                            spacing=2,
                        )

                self.log(
                    f"Department {department.department_name} cleanup summary: "
                    f"{total_processed} processed, {successfully_cleaned} cleaned, {failed_cleanup} failed",
                    spacing=1,
                )

            except Exception as e:
                self.log(f"Error processing department {department.department_name}: {e}", type="error", spacing=1)
                self.log(f"Traceback: {traceback.format_exc()}", type="error", spacing=2)
                continue

    def check_container_service_and_clean(self):
        three_hours_ago = timezone.now() - timedelta(hours=3)
        containers = ContainerService.objects.filter(
            in_use=True, created_on__lte=three_hours_ago, service_type="Browser"
        )
        self.log("============================================")
        self.log(f"Found {containers.count()} container to clean")
        self.log("============================================")
        for container in containers:
            try:
                cid = container.id
                self.log(
                    f"Deleting Container ID: {cid}, Image: {container.image_name}:{container.image_version}, "
                    f"Type: {container.service_type}, Created At: {container.created_on}",
                    spacing=1,
                )
                container.delete()
                self.log(f"Deleted Container ID: {cid}", spacing=1)
            except Exception as e:
                self.log(e)

    def clean_up_old_logs(self):
        try:
            if not os.path.exists(self.log_file_path):
                self.log(f"Log directory {self.log_file_path} does not exist", type="warning")
                return
            if not os.path.isdir(self.log_file_path):
                self.log(f"Log path {self.log_file_path} is not a directory", type="warning")
                return

            cutoff = time.time() - 90 * 86400
            deleted = 0
            for name in os.listdir(self.log_file_path):
                if name.endswith(".log") or ".log." in name or name.endswith(".gz"):
                    p = os.path.join(self.log_file_path, name)
                    try:
                        if os.path.isfile(p) and os.path.getmtime(p) < cutoff:
                            os.remove(p)
                            self.log(f"Deleted {p}")
                            deleted += 1
                    except Exception as e:
                        self.log(f"Error deleting {p}: {e}")
            self.log(f"Deleted {deleted} log files from {self.log_file_path}")
        except Exception as e:
            self.log(f"Error in clean_up_old_logs: {e}", type="error")

    # ----------------------------
    # Entry point
    # ----------------------------
    def run(self):
        logger.debug("Started selecting files for cleanup ")
        try:
            self.filter_and_delete_files()
            self.clean_up_old_logs()
            self.check_container_service_and_clean()
            self.clear_django_sessions()
            self.vacuum_postgres_django_sessions()
            self.house_keeping_logs.success = True

            # prune housekeeping logs older than ~6 months
            six_months_ago = timezone.now() - timedelta(days=30.5 * 6)
            from .models import HouseKeepingLogs  # local to avoid import cycles
            old = HouseKeepingLogs.objects.filter(created_on__lt=six_months_ago)
            count = old.count()
            old.delete()
            self.log(f"Deleted {count} Housekeeping logs from DB")
        except Exception as e:
            self.house_keeping_logs.success = False
            self.log(f"Exception while doing housekeeping {e}")

        self.log("Saving logs in the database")
        self.house_keeping_logs.house_keeping_logs = self.get_logs()
        self.house_keeping_logs.save()
        logger.debug("housekeeping logs saved")
