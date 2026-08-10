"""Backend tests for ShiftGuard Stripe payment flow."""
import time
from datetime import datetime, timedelta, timezone

import requests
import pytest

BASE_URL = "https://stripe-payment-21.preview.emergentagent.com"


@pytest.fixture(scope="module")
def session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def manager_auth(session):
    ts = int(time.time())
    email = f"test_manager_{ts}@example.com"
    password = "TestPass123!"
    reg = {
        "email": email,
        "password": password,
        "name": "Test Manager",
        "role": "manager",
        "phone": "5551234567",
    }
    r = session.post(f"{BASE_URL}/api/auth/register", json=reg)
    assert r.status_code in (200, 201), f"register: {r.status_code} {r.text}"
    code = r.json().get("verificationCode")
    assert code, f"no verificationCode in dev mode: {r.text}"

    r2 = session.post(f"{BASE_URL}/api/auth/verify-email", json={"email": email, "code": code})
    assert r2.status_code in (200, 201), f"verify: {r2.status_code} {r2.text}"
    d = r2.json()
    assert d.get("token") and d.get("user"), d
    return d["token"], d["user"], email, password


def test_healthz(session):
    r = session.get(f"{BASE_URL}/api/healthz")
    assert r.status_code == 200
    assert r.json() == {"status": "ok"}


def test_payments_config(session):
    r = session.get(f"{BASE_URL}/api/payments/config")
    assert r.status_code == 200
    d = r.json()
    assert d["managerFeeBps"] == 150
    assert d["lifeguardFeeBps"] == 150
    assert d["platformFeeBps"] == 300
    assert d["publishableKey"].startswith("pk_")


def test_register_and_verify(manager_auth):
    token, user, email, _ = manager_auth
    assert user["email"] == email
    assert user.get("role") == "manager"
    assert isinstance(token, str) and len(token) > 10


def test_login(session, manager_auth):
    _, _, email, pw = manager_auth
    r = session.post(f"{BASE_URL}/api/auth/login", json={"email": email, "password": pw})
    assert r.status_code == 200, r.text
    d = r.json()
    assert d.get("token") and d["user"]["email"] == email


@pytest.fixture(scope="module")
def created_shift(session, manager_auth):
    token, _, _, _ = manager_auth
    headers = {"Authorization": f"Bearer {token}"}
    start = (datetime.now(timezone.utc) + timedelta(days=3)).isoformat()
    payload = {
        "title": "TEST Pool Lifeguard Shift",
        "location": "123 Test Street, Anytown, CA 90210",
        "payRate": 25,
        "totalHours": 4,
        "startTime": start,
        "certificationRequired": "Lifeguard",
        "description": "Automated test shift",
        "rules": "Arrive 15 min early",
    }
    r = session.post(f"{BASE_URL}/api/shifts", json=payload, headers=headers)
    assert r.status_code in (200, 201), f"create shift: {r.status_code} {r.text}"
    return r.json()


def test_create_shift(created_shift):
    sid = created_shift.get("id") or created_shift.get("shift", {}).get("id")
    assert sid, created_shift
    assert created_shift.get("title", "").startswith("TEST") or created_shift.get("shift", {}).get("title", "").startswith("TEST")


def test_checkout_flow(session, manager_auth, created_shift):
    token, _, _, _ = manager_auth
    headers = {"Authorization": f"Bearer {token}"}
    shift_id = created_shift.get("id") or created_shift.get("shift", {}).get("id")
    r = session.post(
        f"{BASE_URL}/api/payments/checkout",
        json={"shift_id": shift_id, "origin_url": BASE_URL},
        headers=headers,
    )
    assert r.status_code in (200, 201), f"checkout: {r.status_code} {r.text}"
    d = r.json()
    checkout_url = d.get("checkout_url") or d.get("url")
    session_id = d.get("session_id") or d.get("sessionId") or d.get("id")
    assert checkout_url and checkout_url.startswith("https://checkout.stripe.com"), d
    assert session_id, d

    # Status endpoint
    r2 = session.get(f"{BASE_URL}/api/payments/status/{session_id}", headers=headers)
    assert r2.status_code == 200, r2.text
    s = r2.json()
    assert s.get("status") in ("initiated", "pending", "open"), s
    assert s.get("payment_status") in ("pending", "unpaid", "initiated", "no_payment_required"), s

    # Stripe checkout page reachable
    r3 = requests.get(checkout_url, allow_redirects=True, timeout=20)
    assert r3.status_code == 200
    body = r3.text.lower()
    assert "stripe" in body or "checkout" in body
    # fee line item exists (either "platform" or "fee" label)
    assert "fee" in body or "platform" in body, "no fee line item text on Stripe checkout page"


def test_webhook_invalid_signature():
    """Webhook is mounted at /api/stripe/webhook per payments.ts"""
    r = requests.post(
        f"{BASE_URL}/api/stripe/webhook",
        data=b'{"type":"test"}',
        headers={"Content-Type": "application/json", "Stripe-Signature": "invalid_sig"},
        timeout=10,
    )
    assert r.status_code == 400, f"expected 400 for bad signature, got {r.status_code}: {r.text[:200]}"
