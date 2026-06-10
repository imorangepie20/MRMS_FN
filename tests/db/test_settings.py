"""Setting key-value DB helpers."""
from mrms.db.settings import get_setting, set_setting, list_settings


def test_set_and_get(db_conn):
    set_setting(db_conn, "test_key_xx", "test_value")
    assert get_setting(db_conn, "test_key_xx") == "test_value"

    # update
    set_setting(db_conn, "test_key_xx", "updated_value")
    assert get_setting(db_conn, "test_key_xx") == "updated_value"

    # delete via None
    set_setting(db_conn, "test_key_xx", None)
    assert get_setting(db_conn, "test_key_xx") is None


def test_list_settings_bulk(db_conn):
    set_setting(db_conn, "test_a_xx", "1")
    set_setting(db_conn, "test_b_xx", "2")

    result = list_settings(db_conn, ["test_a_xx", "test_b_xx", "test_missing_xx"])
    assert result["test_a_xx"] == "1"
    assert result["test_b_xx"] == "2"
    assert result["test_missing_xx"] is None

    # cleanup
    set_setting(db_conn, "test_a_xx", None)
    set_setting(db_conn, "test_b_xx", None)
