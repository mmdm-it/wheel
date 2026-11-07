#!/bin/bash
# Point wheel-lan.service at scripts/lan-server.py (gz + no-cache) and restart it.
# Needs sudo: run as `sudo bash scripts/install-lan-server.sh`.
set -e
UNIT=/etc/systemd/system/wheel-lan.service
sed -i 's|^ExecStart=.*|ExecStart=/usr/bin/python3 /media/howell/dev_workspace/wheel-v3/scripts/lan-server.py 8080 /media/howell/dev_workspace/wheel-v3|' "$UNIT"
systemctl daemon-reload
systemctl restart wheel-lan.service
systemctl is-active wheel-lan.service
