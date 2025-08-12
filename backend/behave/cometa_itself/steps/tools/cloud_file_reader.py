import msal
import requests
import pandas as pd
from dotenv import load_dotenv
import os
import json

# Load environment variables
load_dotenv(dotenv_path="/opt/code/.env")

# ======== CONFIGURE THESE ========
TENANT_ID = os.getenv("TENANT_ID")
CLIENT_ID = os.getenv("CLIENT_ID")
CLIENT_SECRET = os.getenv("CLIENT_SECRET")
SHARE_POINT_HOSTNAME = os.getenv("SHARE_POINT_HOSTNAME")  # Default SharePoint host
SITES = os.getenv("SITES").split(",")  # Comma-separated list of site names
FILE_PATH = os.getenv("FILE_PATH")  # File path in document library
DRIVE_NAME = os.getenv("DRIVE_NAME", "Documents")  # Usually "Documents" for default doc library
# =================================

# 1. Get Access Token
def get_access_token():
    authority = f"https://login.microsoftonline.com/{TENANT_ID}"
    app = msal.ConfidentialClientApplication(
        CLIENT_ID, authority=authority, client_credential=CLIENT_SECRET
    )
    token_result = app.acquire_token_for_client(scopes=["https://graph.microsoft.com/.default"])

    if "access_token" not in token_result:
        raise Exception("Failed to get access token: ", token_result.get("error_description"))

    return token_result["access_token"]

# 2. Get Site ID
def get_site_id(site_name, access_token):
    site_url = f"https://graph.microsoft.com/v1.0/sites/{SHARE_POINT_HOSTNAME}:/sites/{site_name}"
    res = requests.get(site_url, headers={"Authorization": f"Bearer {access_token}"})
    res.raise_for_status()
    return res.json()["id"], res.json()

# 3. Get Drive ID
def get_drive_id(site_id, drive_name, access_token):
    drive_url = f"https://graph.microsoft.com/v1.0/sites/{site_id}/drives"
    res = requests.get(drive_url, headers={"Authorization": f"Bearer {access_token}"})
    res.raise_for_status()
    for d in res.json()["value"]:
        if d["name"] == drive_name:
            return d["id"], res.json()
    raise Exception(f"Drive '{drive_name}' not found for site {site_id}")

# 4. Download the file
def download_file(site_id, drive_id, file_path, local_filename, access_token):
    download_url = f"https://graph.microsoft.com/v1.0/sites/{site_id}/drives/{drive_id}/root:{file_path}:/content"
    res = requests.get(download_url, headers={"Authorization": f"Bearer {access_token}"})
    res.raise_for_status()
    with open(local_filename, "wb") as f:
        f.write(res.content)
    return local_filename


def download_by_path(drive_id, file_path, access_token, out_name):
    import requests
    clean = file_path.strip("/")
    url = f"https://graph.microsoft.com/v1.0/drives/{drive_id}/root:/{clean}:/content"
    r = requests.get(url, headers={"Authorization": f"Bearer {access_token}"}, stream=True)
    r.raise_for_status()
    with open(out_name, "wb") as f:
        for chunk in r.iter_content(1024 * 1024):
            if chunk:
                f.write(chunk)
    return out_name


# 5. Read Excel file with pandas
def read_excel(local_filename):
    return pd.read_excel(local_filename)


def list_drives_for_site(site_id, access_token):
    """List all document libraries (drives) in the given SharePoint site."""
    url = f"https://graph.microsoft.com/v1.0/sites/{site_id}/drives"
    res = requests.get(url, headers={"Authorization": f"Bearer {access_token}"})
    res.raise_for_status()

    drives = res.json()["value"]
    print(f"\nAvailable drives in site {site_id}:")
    for d in drives:
        print(f"- Name: {d['name']}")
        print(f"  Drive ID: {d['id']}")
        print(f"  Web URL: {d['webUrl']}\n")
    return drives

def list_all_files_in_drive(site_id, drives, drive_name, access_token):
    """List all files recursively in the given drive of a SharePoint site."""
    drive_id = None
    for d in drives:
        if d["name"].lower() == drive_name.lower():
            drive_id = d["id"]
            break
    if not drive_id:
        raise Exception(f"Drive '{drive_name}' not found.")

    print(f"\nListing files in drive '{drive_name}' (ID: {drive_id})\n")

    # Step 2: Recursive listing
    def list_children(item_path=None):
        print(f"Listing children for {item_path}")
        if item_path is None or item_path.strip("/") == "":
            list_url = f"https://graph.microsoft.com/v1.0/drives/{drive_id}/root/children"
        else:
            list_url = f"https://graph.microsoft.com/v1.0/drives/{drive_id}/root:/{item_path}:/children"
        print(f"\n\nListing URL: {list_url}")
        print(list_url)
        r = requests.get(list_url, headers={"Authorization": f"Bearer {access_token}"})
        r.raise_for_status()
        items = r.json()["value"]

        for item in items:
            print(json.dumps(item, indent=4))
            full_path = f"{item_path or ''}/{item['name']}"
            if "folder" in item:  # It's a folder → recurse
                list_children(f"{full_path}")
            else:
                print(f"File: {full_path}")

    list_children()


# Main process
if __name__ == "__main__":
    token = get_access_token()

    for site in SITES:
        print(f"\n=== Processing site: {site} ===")

        # Get Site ID
        site_id, site_info = get_site_id(site, token)
        print("Site ID:", site_id)
        print("Site Info:", json.dumps(site_info, indent=4))

        # Get Drive ID
        drive_id, drive_info = get_drive_id(site_id, DRIVE_NAME, token)
        print("Drive ID:", drive_id)
        print("Drive Info:", json.dumps(drive_info, indent=4))

        # List drives for the site
        drives = list_drives_for_site(site_id, token)
        print("Drives:", json.dumps(drives, indent=4))

        # List all files in the drive
        files = list_all_files_in_drive(site_id, drives, "Documents", token)
        print("Files in drive:", json.dumps(files, indent=4))

        # local_file = download_by_path(drive_id, FILE_PATH, token, f"{site}_myfile.xlsx")
        # print(f"Downloaded file to {local_file}")

        # # Download the file
        # local_file = f"{site}_myfile.xlsx"
        # print(f"Downloading file for {site}...")
        # download_file(site_id, drive_id, FILE_PATH, local_file, token)

        # Read Excel
        # df = read_excel(local_file)
        # print(f"First 5 rows from {site}:")
        # print(df.head())
