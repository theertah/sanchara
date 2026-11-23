import sys
import os

# Ensure backend package can be imported
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from backend.app import app

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    print(f"\n=======================================================")
    print(f"  SANCHARA - BMTC COMMUTER TRANSIT ENGINE RUNNING")
    print(f"  Opening URL: http://localhost:{port}")
    print(f"  BMTC Dashboard: http://localhost:{port}/bmtc/dashboard")
    print(f"  Admin Center: http://localhost:{port}/bmtc/admin")
    print(f"=======================================================\n")
    app.run(host='0.0.0.0', port=port, debug=False)
