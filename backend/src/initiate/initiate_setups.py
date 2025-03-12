import os
# Define the base path
base_path = "/opt/code/migrations"


def initiate_migrations():

    from cometa_pj.settings import MIGRATION_MODULES
    # Create folder if it doesn't exist
    if not os.path.exists(base_path):
        os.makedirs(base_path)
        print(f"Created folder: {base_path}")

    for folder in MIGRATION_MODULES.keys() :
        folder_path = os.path.join(base_path, folder)
        init_file = os.path.join(folder_path, "__init__.py")

        # Create folder if it doesn't exist
        if not os.path.exists(folder_path):
            os.makedirs(folder_path)
            print(f"Created folder: {folder_path}")

        # Create __init__.py if it doesn't exist
        if not os.path.exists(init_file):
            with open(init_file, 'w') as f:
                f.write("# This makes the directory a Python package\n")
            print(f"Created: {init_file}")


if __name__ == "__main__":
    initiate_migrations()
    print("All required folders and __init__.py files are now in place.")
