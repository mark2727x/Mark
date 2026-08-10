"""Backend tests: register/login regression + password reset flow."""
import os
import time
import requests
import pytest

BASE_URL = "https://stripe-payment-21.preview.emergentagent.com"
API = f"{BASE_URL}/api"


@pytest.fixture(scope="module")
def registered_user():
    ts = int(time.time() * 1000)
    email = f"resettest-{ts}@example.com"
    password = "password123"
    r = requests.post(f"{API}/auth/register", json={
        "email": email,
        "phone": "5551234567",
        "password": password,
        "name": "Reset Test",
        "role": "manager",
    }, timeout=20)
    assert r.status_code == 201, f"register failed: {r.status_code} {r.text[:400]}"
    j = r.json()
    assert "verificationCode" in j, f"dev-mode should return code: {j}"
    # verify email
    v = requests.post(f"{API}/auth/verify-email", json={
        "email": email, "code": j["verificationCode"],
    }, timeout=20)
    assert v.status_code == 200, f"verify-email failed: {v.status_code} {v.text[:400]}"
    vj = v.json()
    assert "token" in vj and "user" in vj
    return {"email": email, "password": password, "token": vj["token"], "user": vj["user"]}


class TestRegisterLoginRegression:
    def test_login_returns_json_not_html(self, registered_user):
        r = requests.post(f"{API}/auth/login", json={
            "email": registered_user["email"],
            "password": registered_user["password"],
        }, timeout=20)
        assert r.status_code == 200, r.text[:400]
        assert r.headers.get("content-type", "").startswith("application/json")
        j = r.json()
        assert "token" in j and "user" in j
        assert j["user"]["email"] == registered_user["email"]

    def test_register_bad_phone_json_error(self):
        ts = int(time.time() * 1000)
        r = requests.post(f"{API}/auth/register", json={
            "email": f"badphone-{ts}@example.com",
            "phone": "123",
            "password": "password123",
            "name": "x",
            "role": "manager",
        }, timeout=20)
        assert r.status_code == 400
        assert r.headers.get("content-type", "").startswith("application/json")


class TestPasswordReset:
    def test_forgot_password_known_email_returns_code(self, registered_user):
        r = requests.post(f"{API}/auth/forgot-password", json={
            "email": registered_user["email"],
        }, timeout=20)
        assert r.status_code == 200, r.text[:400]
        j = r.json()
        assert j.get("ok") is True
        assert "resetCode" in j and len(j["resetCode"]) == 6

    def test_forgot_password_unknown_email_no_code(self):
        r = requests.post(f"{API}/auth/forgot-password", json={
            "email": "nobody-not-registered-xyz@example.com",
        }, timeout=20)
        assert r.status_code == 200
        j = r.json()
        assert j.get("ok") is True
        assert "resetCode" not in j, f"info leak: {j}"

    def test_reset_password_wrong_code_400(self, registered_user):
        r = requests.post(f"{API}/auth/reset-password", json={
            "email": registered_user["email"],
            "code": "000000",
            "newPassword": "newpassword123",
        }, timeout=20)
        assert r.status_code == 400

    def test_full_reset_flow_and_old_password_invalidated(self, registered_user):
        # Request new code
        r = requests.post(f"{API}/auth/forgot-password", json={
            "email": registered_user["email"],
        }, timeout=20)
        code = r.json()["resetCode"]
        new_password = "newpassword456"
        r2 = requests.post(f"{API}/auth/reset-password", json={
            "email": registered_user["email"],
            "code": code,
            "newPassword": new_password,
        }, timeout=20)
        assert r2.status_code == 200, r2.text[:400]
        j = r2.json()
        assert "token" in j and "user" in j
        # Old password should now fail
        old = requests.post(f"{API}/auth/login", json={
            "email": registered_user["email"],
            "password": registered_user["password"],
        }, timeout=20)
        assert old.status_code == 401, f"old password should not work: {old.status_code}"
        # New password should work
        new = requests.post(f"{API}/auth/login", json={
            "email": registered_user["email"],
            "password": new_password,
        }, timeout=20)
        assert new.status_code == 200, new.text[:400]
        assert "token" in new.json()
        # Update the fixture creds for downstream (module-scope)
        registered_user["password"] = new_password

    def test_reset_password_short_password_400(self, registered_user):
        r = requests.post(f"{API}/auth/forgot-password", json={
            "email": registered_user["email"],
        }, timeout=20)
        code = r.json()["resetCode"]
        r2 = requests.post(f"{API}/auth/reset-password", json={
            "email": registered_user["email"],
            "code": code,
            "newPassword": "short",
        }, timeout=20)
        assert r2.status_code == 400


class TestPaymentsConfig:
    def test_payments_config_manager(self, registered_user):
        # Login to get fresh token (password may have been reset above)
        # Try current password; if fails, use new
        for pw in [registered_user["password"], "newpassword456"]:
            r = requests.post(f"{API}/auth/login", json={
                "email": registered_user["email"], "password": pw,
            }, timeout=20)
            if r.status_code == 200:
                token = r.json()["token"]
                break
        else:
            pytest.fail("Could not login to test payments config")
        cfg = requests.get(f"{API}/payments/config",
                          headers={"Authorization": f"Bearer {token}"}, timeout=20)
        assert cfg.status_code == 200, cfg.text[:400]
        j = cfg.json()
        assert "publishableKey" in j
        assert j.get("platformFeeBps") == 300, f"expected 300 bps, got {j.get('platformFeeBps')}"
