# Execute all tests of a certain application

    cd <application>
    behave --summary --junit --junit-directory junit_reports/

# Execute a specific test
    cd <application>
    behave one.feature --summary --junit --junit-directory junit_reports/

# Execute all tests and create summary (_deprecated_)

    ./run.sh

