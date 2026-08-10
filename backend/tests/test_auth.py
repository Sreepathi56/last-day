def test_health(client):
    r = client.get("/api/health")
    assert r.status_code == 200
    assert r.json()["status"] == "ok"


def test_register_returns_token_and_user(client):
    r = client.post(
        "/api/auth/register",
        json={"email": "register@example.com", "password": "password123"},
    )
    assert r.status_code == 201
    body = r.json()
    assert body["access_token"]
    assert body["token_type"] == "bearer"
    assert body["user"]["email"] == "register@example.com"


def test_register_duplicate_email(client):
    payload = {"email": "dup@example.com", "password": "password123"}
    assert client.post("/api/auth/register", json=payload).status_code == 201
    r = client.post("/api/auth/register", json=payload)
    assert r.status_code == 400
    assert "already" in r.json()["detail"].lower()


def test_register_rejects_short_password(client):
    r = client.post(
        "/api/auth/register",
        json={"email": "short@example.com", "password": "abc"},
    )
    assert r.status_code == 422


def test_login_success_and_failure(client):
    client.post(
        "/api/auth/register",
        json={"email": "login@example.com", "password": "password123"},
    )
    ok = client.post(
        "/api/auth/login",
        json={"email": "login@example.com", "password": "password123"},
    )
    assert ok.status_code == 200
    assert ok.json()["access_token"]

    bad = client.post(
        "/api/auth/login",
        json={"email": "login@example.com", "password": "wrong-password"},
    )
    assert bad.status_code == 401


def test_me_requires_token(client):
    assert client.get("/api/auth/me").status_code == 401


def test_me_with_token(client, auth_headers):
    r = client.get("/api/auth/me", headers=auth_headers)
    assert r.status_code == 200
    assert r.json()["email"] == "test-user@example.com"
