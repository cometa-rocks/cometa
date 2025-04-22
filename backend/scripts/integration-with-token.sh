#!/bin/bash
#
# integration-with-token.sh - Run Cometa tests from a folder using API token authentication
# =====================================================================================
#
# Description:
#   This script triggers Cometa tests in a specified folder through the API
#   using token-based authentication. It can optionally monitor test execution
#   and report results.
#
# Author:
#   Cometa Team
#
# Usage:
#   ./integration-with-token.sh [OPTIONS] SECRET_ID SECRET_KEY FOLDER_ID
#
# Arguments:
#   SECRET_ID   - The secret ID for API authentication
#   SECRET_KEY  - The secret key for API authentication
#   FOLDER_ID   - The ID of the folder containing tests to run
#
# Options:
#   -p, --poll         Enable polling for test results (default: disabled)
#   -i, --interval N   Set polling interval in seconds (default: 10)
#   -m, --max N        Set maximum polling attempts (default: 60)
#   -d, --debug        Enable debug output (also saves JSON response to debug_output.json)
#   -j, --jq           Use jq for JSON parsing (must have jq installed)
#   -h, --help         Display this help message
#
# Examples:
#   ./integration-with-token.sh mySecretId mySecretKey 328
#   ./integration-with-token.sh --poll mySecretId mySecretKey 328
#   ./integration-with-token.sh -p -i 15 mySecretId mySecretKey 328
#
# Output:
#   - Summary of triggered feature tests
#   - Result details for each test if polling is enabled
#   - JSON output for programmatic consumption
#   - Debug files if debug mode is enabled
#
# Exit Codes:
#   0 - Success
#   1 - Error (invalid arguments, API error, etc.)
#
# =====================================================================================

# Display help function
display_help() {
    echo "Usage: $0 [OPTIONS] SECRET_ID SECRET_KEY FOLDER_ID"
    echo ""
    echo "Description:"
    echo "  This script triggers Cometa tests in a specified folder and optionally monitors their execution,"
    echo "  providing results in both readable and JSON formats."
    echo ""
    echo "Arguments:"
    echo "  SECRET_ID   Required. The secret ID to use for authentication."
    echo "  SECRET_KEY  Required. The secret key to use for authentication."
    echo "  FOLDER_ID   Required. The ID of the folder containing tests to run."
    echo ""
    echo "Options:"
    echo "  -p, --poll         Enable polling for test results (default: disabled)"
    echo "  -i, --interval N   Set polling interval in seconds (default: 10)"
    echo "  -m, --max N        Set maximum polling attempts (default: 60)"
    echo "  -d, --debug        Enable debug output (also saves JSON response to debug_output.json)"
    echo "  -j, --jq           Use jq for JSON parsing (must have jq installed)"
    echo "  -h, --help         Display this help message"
    echo ""
    echo "Example:"
    echo "  $0 mySecretId mySecretKey 328"
    echo "  $0 --poll mySecretId mySecretKey 328  (enable polling)"
    echo "  $0 -p -i 15 mySecretId mySecretKey 328  (poll every 15 seconds)"
    echo "  $0 -d mySecretId mySecretKey 328  (with debug output and JSON file)"
    echo "  $0 -d -j mySecretId mySecretKey 328  (use jq for better JSON parsing)"
    exit 1
}

# Default settings
POLL=false
POLL_INTERVAL=10        # Polling interval in seconds
MAX_POLL_ATTEMPTS=60    # Maximum number of polling attempts
DEBUG=false             # Debug output disabled by default
USE_JQ=false            # Use jq for JSON parsing
FQDN='https://prod.cometa.rocks'
DEBUG_FILE="debug_output.json"  # Default debug output file

# Check if jq is installed
check_jq() {
    if command -v jq &> /dev/null; then
        return 0
    else
        return 1
    fi
}

# Parse options
while [[ "$1" =~ ^- ]]; do
    case "$1" in
        -p|--poll)
            POLL=true
            shift
            ;;
        -i|--interval)
            POLL_INTERVAL="$2"
            shift 2
            ;;
        -m|--max)
            MAX_POLL_ATTEMPTS="$2"
            shift 2
            ;;
        -d|--debug)
            DEBUG=true
            shift
            ;;
        -j|--jq)
            if check_jq; then
                USE_JQ=true
            else
                echo "⚠️ Warning: jq is not installed. Falling back to grep parsing."
            fi
            shift
            ;;
        -h|--help)
            display_help
            ;;
        *)
            echo "Unknown option: $1"
            display_help
            ;;
    esac
done

# Check remaining arguments
if [ "$#" -ne 3 ]; then
    echo "Error: Missing required arguments"
    display_help
else
    # All required parameters are provided
    SECRET_ID="$1"
    SECRET_KEY="$2"
    FOLDER_ID="$3"
fi

# Print execution summary
echo "▶️  Executing features for folder ID: $FOLDER_ID"
if [ "$POLL" = true ]; then
    echo "ℹ️  Polling is enabled (interval: ${POLL_INTERVAL}s, max attempts: $MAX_POLL_ATTEMPTS)"
else
    echo "ℹ️  Polling is disabled (features will be triggered but not monitored)"
fi
if [ "$DEBUG" = true ]; then
    echo "🔍 Debug mode enabled (JSON responses will be saved to $DEBUG_FILE)"
fi
if [ "$USE_JQ" = true ]; then
    echo "🔧 Using jq for JSON parsing"
fi

# Make the API call and capture the response and HTTP status code
RESPONSE=$(curl --location ${FQDN}'/backend/integrations/v2/execute' \
--header 'Content-Type: application/json' \
--header 'Cookie: x_csrf=25zqEMwq7as' \
--write-out "\n%{http_code}" \
--silent \
--output - \
--data '{
    "secret": {
        "secret_id":"'${SECRET_ID}'", 
        "secret_key":"'${SECRET_KEY}'"
    },
    "test_info": {
        "execution_type":"folder",
        "id":'${FOLDER_ID}',
        "recursive":false
    }
}')

# Extract status code and response body
HTTP_STATUS=$(echo "$RESPONSE" | tail -n1)
RESPONSE_BODY=$(echo "$RESPONSE" | sed '$ d')

# Save the response to debug file if debug is enabled
if [ "$DEBUG" = true ]; then
    echo "$RESPONSE_BODY" > "$DEBUG_FILE"
    if [ "$USE_JQ" = true ]; then
        echo -e "\n📄 JSON Response:"
        echo "$RESPONSE_BODY" | jq
    fi
    echo $RESPONSE_BODY
    echo "💾 Raw API response saved to $DEBUG_FILE"
fi

# Check for 200 status code
if [ "$HTTP_STATUS" -ne 200 ]; then
    echo "❌ Error: API request failed with status code $HTTP_STATUS"
    echo "Response: $RESPONSE_BODY"
    exit 1
fi

echo "✅ API request successful (HTTP $HTTP_STATUS)"

# Create arrays to store feature result IDs and their corresponding feature IDs
FEATURE_IDS=()
RESULT_IDS=()
EXECUTION_SUMMARY=()

# Extract feature IDs and result IDs
echo -e "\n📋 Feature execution summary:"
echo -e "------------------------"
SUCCESS_COUNT=0
FAILURE_COUNT=0

# Parse response using jq if available, otherwise use grep
if [ "$USE_JQ" = true ]; then
    # Using jq for better JSON parsing
    TESTS=$(echo "$RESPONSE_BODY" | jq -r '.results | to_entries[] | "\(.key):\(.value.success):\(.value.feature_result_ids | join(","))"')
    
    while IFS=: read -r feature_id success result_ids; do
        # Process each test
        if [ "$success" = "true" ]; then
            STATUS="✅ Triggered"
            ((SUCCESS_COUNT++))
        else
            STATUS="❌ Failed to trigger"
            ((FAILURE_COUNT++))
        fi
        
        # Process each result ID (there may be multiple)
        IFS=',' read -ra RESULT_ID_ARRAY <<< "$result_ids"
        RESULT_ID_STR=""
        for result_id in "${RESULT_ID_ARRAY[@]}"; do
            if [ -n "$result_id" ]; then
                if [ -n "$RESULT_ID_STR" ]; then
                    RESULT_ID_STR="$RESULT_ID_STR, $result_id"
                else
                    RESULT_ID_STR="$result_id"
                fi
                FEATURE_IDS+=("$feature_id")
                RESULT_IDS+=("$result_id")
                
                # Store in execution summary array for JSON output
                EXECUTION_SUMMARY+=("{\"feature_id\":\"$feature_id\",\"result_id\":\"$result_id\",\"triggered\":$success}")
            fi
        done
        
        echo "Feature ID: $feature_id | Result IDs: $RESULT_ID_STR | Status: $STATUS"
        
    done <<< "$TESTS"
else
    # Using grep for parsing (fallback method)
    # First extract all feature IDs
    TEST_IDS=$(echo "$RESPONSE_BODY" | grep -o '"[0-9]*": {"success":' | grep -o '[0-9]*')
    
    for feature_id in $TEST_IDS; do
        # Extract success status
        SUCCESS=$(echo "$RESPONSE_BODY" | grep -o "\"$feature_id\": {\"success\": [a-z]*" | grep -o '[a-z]*$')
        
        if [ "$SUCCESS" = "true" ]; then
            STATUS="✅ Triggered"
            ((SUCCESS_COUNT++))
        else
            STATUS="❌ Failed to trigger"
            ((FAILURE_COUNT++))
        fi
        
        # Extract all result IDs for this test (handles multiple result IDs)
        RESULT_ID_LIST=$(echo "$RESPONSE_BODY" | grep -o "\"$feature_id\": {\"success\": [a-z]*, \"feature_result_ids\": \\[[0-9,]*\\]" | grep -o '\\[[0-9,]*\\]' | tr -d '[]')
        
        # Process each result ID
        RESULT_ID_STR=""
        for result_id in ${RESULT_ID_LIST//,/ }; do
            if [ -n "$result_id" ]; then
                if [ -n "$RESULT_ID_STR" ]; then
                    RESULT_ID_STR="$RESULT_ID_STR, $result_id"
                else
                    RESULT_ID_STR="$result_id"
                fi
                FEATURE_IDS+=("$feature_id")
                RESULT_IDS+=("$result_id")
                
                # Store in execution summary array for JSON output
                EXECUTION_SUMMARY+=("{\"feature_id\":\"$feature_id\",\"result_id\":\"$result_id\",\"triggered\":$SUCCESS}")
            fi
        done
        
        echo "Feature ID: $feature_id | Result IDs: $RESULT_ID_STR | Status: $STATUS"
    done
fi

echo -e "------------------------"
echo -e "Total: $((SUCCESS_COUNT + FAILURE_COUNT))"

# Create JSON output
JSON_OUTPUT="{\"execution_summary\":{\"total_features\":$((SUCCESS_COUNT + FAILURE_COUNT))},\"features\":["
for i in "${!EXECUTION_SUMMARY[@]}"; do
    if [ $i -gt 0 ]; then
        JSON_OUTPUT="$JSON_OUTPUT,"
    fi
    JSON_OUTPUT="$JSON_OUTPUT${EXECUTION_SUMMARY[$i]}"
done
JSON_OUTPUT="$JSON_OUTPUT]}"

# Print JSON output
echo -e "\n📊 Execution JSON:"
echo "$JSON_OUTPUT"

# Append the JSON output to debug file if debug is enabled
if [ "$DEBUG" = true ]; then
    echo -e "\n--- PARSED EXECUTION JSON ---" >> "$DEBUG_FILE"
    echo "$JSON_OUTPUT" >> "$DEBUG_FILE"
    echo "💾 Parsed execution JSON appended to $DEBUG_FILE"
fi

# Exit if polling is disabled or no features were triggered
if [ "$POLL" = false ] || [ ${#RESULT_IDS[@]} -eq 0 ]; then
    if [ "$POLL" = false ]; then
        echo -e "\nℹ️  Polling is disabled. Features were triggered but results will not be monitored."
    elif [ ${#RESULT_IDS[@]} -eq 0 ]; then
        echo -e "\n❌ No features were triggered successfully. Nothing to poll."
    fi
    exit 0
fi

# Function to poll for feature result and check if it's completed
poll_feature_result() {
    local result_id=$1
    local feature_id=$2
    local url="${FQDN}/api/feature_results/${result_id}/"
    local results=()
    local poll_debug_file=""
    
    if [ "$DEBUG" = true ]; then
        poll_debug_file="${DEBUG_FILE%.json}_result_${result_id}.json"
    fi
    
    echo -e "\n🔄 Polling result for Feature ID: $feature_id, Result ID: $result_id"
    
    for ((attempt=1; attempt<=MAX_POLL_ATTEMPTS; attempt++)); do
        echo "Attempt $attempt of $MAX_POLL_ATTEMPTS..."
        
        POLL_RESPONSE=$(curl --location "$url" \
        --header 'Content-Type: application/json' \
        --header 'Cookie: x_csrf=25zqEMwq7as' \
        --silent \
        --data '{ 
            "secret": {
                "secret_id":"'${SECRET_ID}'", 
                "secret_key":"'${SECRET_KEY}'"
            }
        }'
        )
        
        # Save the poll response to debug file if debug is enabled
        if [ "$DEBUG" = true ]; then
            echo "$POLL_RESPONSE" > "$poll_debug_file"
            if [ "$USE_JQ" = true ]; then
                echo -e "\n--- DEBUG: Formatted Poll Response ---"
                echo "$POLL_RESPONSE" | jq
            fi
            echo "💾 Poll response saved to $poll_debug_file"
        fi
        
        # Debug output
        if [ "$DEBUG" = true ] && [ "$USE_JQ" = false ]; then
            echo -e "\n--- DEBUG: Raw API Response (first 300 chars) ---"
            echo "${POLL_RESPONSE:0:300}..." 
            
            # Check if we're getting the expected JSON structure
            echo "--- DEBUG: Grep Results ---"
            echo "running value: $(echo "$POLL_RESPONSE" | grep -o '"running":[a-z]*' | cut -d ':' -f2 || echo 'NOT FOUND')"
            echo "Feature name: $(echo "$POLL_RESPONSE" | grep -o '"feature_name":"[^"]*"' || echo 'NOT FOUND')"
            echo "Total steps: $(echo "$POLL_RESPONSE" | grep -o '"total":[0-9]*' || echo 'NOT FOUND')"
            echo "Status: $(echo "$POLL_RESPONSE" | grep -o '"status":"[^"]*"' || echo 'NOT FOUND')"
            echo "------------------------"
        fi
        
        # Extract running status
        if [ "$USE_JQ" = true ]; then
            RUNNING=$(echo "$POLL_RESPONSE" | jq -r '.running | tostring')
        else
            RUNNING=$(echo "$POLL_RESPONSE" | grep -o '"running":[a-z]*' | cut -d ':' -f2)
        fi
        
        if [ "$RUNNING" = "false" ]; then
            echo "✅ Feature completed execution!"
            
            # Extract result details
            if [ "$USE_JQ" = true ]; then
                FEATURE_NAME=$(echo "$POLL_RESPONSE" | jq -r '.feature_name')
                TOTAL_STEPS=$(echo "$POLL_RESPONSE" | jq -r '.total')
                OK_STEPS=$(echo "$POLL_RESPONSE" | jq -r '.ok')
                FAILS=$(echo "$POLL_RESPONSE" | jq -r '.fails')
                SKIPPED=$(echo "$POLL_RESPONSE" | jq -r '.skipped')
                EXECUTION_TIME=$(echo "$POLL_RESPONSE" | jq -r '.execution_time')
                STATUS=$(echo "$POLL_RESPONSE" | jq -r '.status')
            else
                FEATURE_NAME=$(echo "$POLL_RESPONSE" | grep -o '"feature_name":"[^"]*"' | cut -d ':' -f2 | tr -d '"')
                TOTAL_STEPS=$(echo "$POLL_RESPONSE" | grep -o '"total":[0-9]*' | cut -d ':' -f2)
                OK_STEPS=$(echo "$POLL_RESPONSE" | grep -o '"ok":[0-9]*' | cut -d ':' -f2)
                FAILS=$(echo "$POLL_RESPONSE" | grep -o '"fails":[0-9]*' | cut -d ':' -f2)
                SKIPPED=$(echo "$POLL_RESPONSE" | grep -o '"skipped":[0-9]*' | cut -d ':' -f2)
                EXECUTION_TIME=$(echo "$POLL_RESPONSE" | grep -o '"execution_time":[0-9]*' | cut -d ':' -f2)
                STATUS=$(echo "$POLL_RESPONSE" | grep -o '"status":"[^"]*"' | cut -d ':' -f2 | tr -d '"')
            fi
            
            # Calculate time in minutes and seconds
            MINUTES=$((EXECUTION_TIME / 60))
            SECONDS=$((EXECUTION_TIME % 60))
            
            # Print result summary with emoji indicators
            STATUS_ICON="✅"
            if [ "$STATUS" != "passed" ]; then
                STATUS_ICON="❌"
            fi
            
            # Create a nice formatted output
            echo -e "\n📝 Test Result Summary:"
            echo "=================================================="
            echo "🧪 Feature: $FEATURE_NAME"
            echo "🔢 Feature ID: $feature_id"
            echo "🏷️ Result ID: $result_id"
            echo "🚦 Status: $STATUS_ICON $STATUS"
            echo "📊 Steps:"
            echo "   - Total:   $TOTAL_STEPS"
            echo "   - Passed:  $OK_STEPS"
            echo "   - Failed:  $FAILS"
            echo "   - Skipped: $SKIPPED"
            echo "⏱️ Execution time: ${MINUTES}m ${SECONDS}s (${EXECUTION_TIME} seconds)"
            echo "=================================================="
            
            # Create JSON output for this result
            RESULT_JSON="{\"feature_id\":\"$feature_id\",\"result_id\":\"$result_id\",\"feature_name\":\"$FEATURE_NAME\",\"status\":\"$STATUS\",\"steps\":{\"total\":$TOTAL_STEPS,\"passed\":$OK_STEPS,\"failed\":$FAILS,\"skipped\":$SKIPPED},\"execution_time\":$EXECUTION_TIME}"
            results+=("$RESULT_JSON")
            echo -e "\n📊 Result JSON:"
            echo "$RESULT_JSON"
            
            # Append the result JSON to debug file if debug is enabled
            if [ "$DEBUG" = true ]; then
                echo -e "\n--- PARSED RESULT JSON ---" >> "$poll_debug_file"
                echo "$RESULT_JSON" >> "$poll_debug_file"
                echo "💾 Parsed result JSON appended to $poll_debug_file"
            fi
            
            return 0
        else
            echo "🔄 Feature is still running. Waiting $POLL_INTERVAL seconds before next check..."
            sleep $POLL_INTERVAL
        fi
    done
    
    echo "⏱️ Timed out waiting for feature to complete!"
    return 1
}

# Process each result ID if polling is enabled
if [ "$POLL" = true ]; then
    POLL_RESULTS=()
    echo -e "\n🔍 Starting to poll for feature results..."
    for i in "${!RESULT_IDS[@]}"; do
        poll_feature_result "${RESULT_IDS[$i]}" "${FEATURE_IDS[$i]}"
        POLL_RESULTS+=("$RESULT_JSON")
    done
    
    # Create comprehensive JSON with all results
    COMPREHENSIVE_JSON="{\"execution_summary\":{\"total_features\":$((SUCCESS_COUNT + FAILURE_COUNT))},\"features\":["
    for i in "${!EXECUTION_SUMMARY[@]}"; do
        if [ $i -gt 0 ]; then
            COMPREHENSIVE_JSON="$COMPREHENSIVE_JSON,"
        fi
        COMPREHENSIVE_JSON="$COMPREHENSIVE_JSON${EXECUTION_SUMMARY[$i]}"
    done
    COMPREHENSIVE_JSON="$COMPREHENSIVE_JSON],\"results\":["
    for i in "${!POLL_RESULTS[@]}"; do
        if [ $i -gt 0 ]; then
            COMPREHENSIVE_JSON="$COMPREHENSIVE_JSON,"
        fi
        COMPREHENSIVE_JSON="$COMPREHENSIVE_JSON${POLL_RESULTS[$i]}"
    done
    COMPREHENSIVE_JSON="$COMPREHENSIVE_JSON]}"
    
    echo -e "\n📊 Final Comprehensive JSON:"
    echo "$COMPREHENSIVE_JSON"
    
    # Save the comprehensive JSON to a final debug file if debug is enabled
    if [ "$DEBUG" = true ]; then
        FINAL_DEBUG_FILE="${DEBUG_FILE%.json}_final.json"
        echo "$COMPREHENSIVE_JSON" > "$FINAL_DEBUG_FILE"
        echo "💾 Final comprehensive JSON saved to $FINAL_DEBUG_FILE"
    fi
    
    echo -e "\n✅ All feature results have been processed."
fi

exit 0

