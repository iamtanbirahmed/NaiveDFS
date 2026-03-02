#!/bin/bash

# Exit on failure
set -e

echo "1. Generating a 300MB test file..."
# Generate random data
dd if=/dev/urandom of=test_300mb.dat bs=1M count=300

echo "2. Uploading the file to the Control Plane..."
curl -X POST -F "file=@test_300mb.dat" http://localhost:8080/api/files/upload

echo "3. Downloading the file from the Control Plane..."
curl -X GET "http://localhost:8080/api/files/download?filename=test_300mb.dat" -o downloaded_300mb.dat --fail

echo "4. Verifying file integrity..."
ORIG_HASH=$(md5 -q test_300mb.dat)
NEW_HASH=$(md5 -q downloaded_300mb.dat)

if [ "$ORIG_HASH" == "$NEW_HASH" ]; then
    echo "✅ SUCCESS: File integrity verified. ($ORIG_HASH)"
else
    echo "❌ ERROR: File mismatch! Original: $ORIG_HASH, Downloaded: $NEW_HASH"
    exit 1
fi

echo "5. Cleaning up test files..."
rm test_300mb.dat downloaded_300mb.dat

echo "All tests passed!"
