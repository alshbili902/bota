import os
from pathlib import Path
import pytest
from app.core.config import settings
from app.core.rate_limit import limiter
from app.db.supabase import db_manager

# Mark environment as test
os.environ["ENVIRONMENT"] = "test"
settings.ENVIRONMENT = "test"

# Use dedicated isolated test database path
TEST_DB_PATH = Path("storage/test_rahami.db")
settings.DB_PATH = TEST_DB_PATH

# Disable rate limiting during automated tests
limiter.enabled = False

# Preserve original supabase client and isolate tests from production Supabase
_original_supabase_client = db_manager.supabase_client
db_manager.supabase_client = None


@pytest.fixture(autouse=True, scope="session")
def setup_test_environment():
    """Setup and teardown isolated test database environment."""
    # Ensure test database directory exists
    TEST_DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    
    yield
    
    # Teardown: Remove test database file
    if TEST_DB_PATH.exists():
        try:
            TEST_DB_PATH.unlink()
        except Exception:
            pass


@pytest.fixture(autouse=True)
def init_test_db_tables():
    """Ensure test database tables and admin are initialized for each test."""
    import asyncio
    from app.db.database import init_db
    asyncio.run(init_db())
    asyncio.run(db_manager.init_admin_database())
    from tests.test_admin_auth import reset_test_admin
    asyncio.run(reset_test_admin())
    limiter.enabled = False
    yield
    limiter.enabled = False

