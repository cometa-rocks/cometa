from backend.models import Feature_Runs
from backend.utility.functions import calculate_run_totals

runs = Feature_Runs.available_objects.all()

counter = 0

for run in runs:
    print('Running totals calculation for runId:', run.run_id)
    counter = counter + 1
    calculate_run_totals(run)
    
print('Runs calculated:', str(counter))