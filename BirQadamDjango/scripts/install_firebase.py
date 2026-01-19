#!/usr/bin/env python
import subprocess
import sys

def install_firebase_admin() -> bool:
    """Установка firebase-admin пакета"""
    try:
        print("Installing firebase-admin...")
        result = subprocess.run([
            sys.executable, '-m', 'pip', 'install', 'firebase-admin==6.5.0'
        ], capture_output=True, text=True)

        if result.returncode == 0:
            print("SUCCESS: firebase-admin installed!")
            return True
        else:
            print(f"ERROR installing: {result.stderr}")
            return False
    except Exception as e:
        print(f"ERROR: {e}")
        return False

if __name__ == "__main__":
    install_firebase_admin()