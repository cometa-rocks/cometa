import pandas as pd

def excel_to_json(excel_file_path, sheet_name, header_row=None, value_row=None):
    try:
        xls = pd.ExcelFile(excel_file_path)
        # Validate the sheet name
        if sheet_name not in xls.sheet_names:
            raise ValueError(f"Sheet name '{sheet_name}' not found in the Excel file. Available sheets: {xls.sheet_names}")
      
        # Read the specified sheet from the Excel file
        df = pd.read_excel(excel_file_path, sheet_name="EmployeeMaster")
        
        # If specific row indices are provided, set header and select data row
        if header_row is not None and value_row is not None:
            # Ensure the row indices are within the DataFrame's range
            0 
            table_rows = len(df)+1
            
            if not 0 < header_row <= table_rows:
                raise IndexError(f"Invalid header row index {header_row}, available rows are between 1 to {table_rows}")
            
            if not 0 < value_row <= table_rows:
                raise IndexError(f"Invalid header row index {value_row}, available rows are between 1 to {table_rows}")            
            
            header_row = header_row - 2
            if header_row >= 0:
                # Set the header using the specified header_row
                df.columns = df.iloc[header_row]
            # Select the specified value_row
            df = df.loc[:, ~df.columns.isnull() & (df.columns != '')]
            value_row = value_row - 2
            df = df.iloc[[value_row]]
            df = df.fillna('')
        
        # Convert DataFrame to records (list of dictionaries)
        sheet_data = df.to_dict(orient='records')        
        print(sheet_data)
        
    except Exception as e:
        print(f"Error processing Excel file: {str(e)}")
        return None

# Example usage
if __name__ == "__main__":
    # Replace with your Excel file path
    excel_file = "/opt/code/ee/cometa_itself/steps/Master_locator_(3).xlsx"
    # Optional: specify JSON output file path
    json_file = "/opt/code/ee/cometa_itself/steps/utils/output.json"
    sheet_name = "EmployeeMaster"
    # Convert Excel to JSON, reading only a specific row
    excel_to_json(excel_file, sheet_name, header_row=2, value_row=3)
    