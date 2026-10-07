#!/usr/bin/env bash
# ==============================================================================
# DineDesk - Restaurant Reservation & Kitchen Order Console
# Project 05 | Local Launch Script
# ==============================================================================

set -e

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
cd "$DIR"

echo "=================================================================="
echo "  🍽️  Launching DineDesk Platform (Project 05)"
echo "=================================================================="

# Ensure Python 3 is installed
if ! command -v python3 &> /dev/null; then
    echo "❌ Error: python3 is not installed or not in PATH."
    exit 1
fi

# Run the unified full-stack server
exec python3 app.py
