#!/bin/bash
# Test FTP connection

if [ ! -f .deploy-config ]; then
    echo "Error: .deploy-config not found"
    exit 1
fi

source .deploy-config

echo "Testing FTP connection..."
echo "Host: $FTP_HOST"
echo "User: $FTP_USER"
echo "Path: $FTP_PATH"
echo ""
echo "Attempting connection..."

lftp -c "
set ssl:verify-certificate no
open ftp://${FTP_USER}:${FTP_PASS}@${FTP_HOST}
pwd
ls
bye
"

echo ""
echo "If you see a directory listing above, the connection works!"
echo "If not, check your FTP credentials in cPanel."
