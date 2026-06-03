# conftest.py
import sys
from pathlib import Path

# Add project root to Python path
root = Path(__file__).parent
sys.path.insert(0, str(root))