"""Tests for the AI prediction endpoint (POST /api/sim/predict).

Data-driven only — serves precomputed scores from the local synthetic dataset,
so no AWS or database access is needed. Mirrors issue #8's testing criteria:
ideal scenario -> high quality / low stress; poor scenario -> the opposite;
unknown crop -> a clear error.
"""

IDEAL_LETTUCE = {
    "crop_type": "lettuce",
    "ph": 6.0,
    "air_temperature_c": 20.0,
    "humidity_percent": 60.0,
    "growth_percent": 30.0,
}

POOR_LETTUCE = {
    "crop_type": "lettuce",
    "ph": 4.5,
    "air_temperature_c": 33.0,
    "humidity_percent": 30.0,
    "growth_percent": 30.0,
}

# Every field on target, including the two IDEAL_LETTUCE leaves at their defaults
# (ec 1.2 is on target, but co2 defaults to 400 against a target of 800). Only this
# payload actually produces zero stress.
ZERO_STRESS_LETTUCE = {
    "crop_type": "lettuce",
    "ph": 6.0,
    "ec": 1.2,
    "air_temperature_c": 20.0,
    "humidity_percent": 60.0,
    "co2_ppm": 800.0,
    "growth_percent": 30.0,
}


def test_predict_ideal_lettuce_high_quality_low_stress(client):
    response = client.post("/api/sim/predict", json=IDEAL_LETTUCE)
    assert response.status_code == 200
    body = response.json()
    assert body["harvest_quality"] >= 70
    assert body["stress_factor"] <= 30
    assert body["source"] == "engine"
    assert body["explanation"]


def test_predict_poor_lettuce_lower_quality_higher_stress(client):
    ideal = client.post("/api/sim/predict", json=IDEAL_LETTUCE).json()
    poor = client.post("/api/sim/predict", json=POOR_LETTUCE).json()
    assert poor["harvest_quality"] < ideal["harvest_quality"]
    assert poor["stress_factor"] > ideal["stress_factor"]


def test_predict_supports_tomato_alias(client):
    # The dashboard sends "tomatoes"; the backend maps it to the dataset's "tomato".
    response = client.post(
        "/api/sim/predict",
        json={"crop_type": "tomatoes", "ph": 6.0, "air_temperature_c": 26.0, "humidity_percent": 70.0},
    )
    assert response.status_code == 200
    assert response.json()["harvest_quality"] > 0


def test_predict_unknown_crop_returns_clear_error(client):
    response = client.post("/api/sim/predict", json={"crop_type": "herbs"})
    assert response.status_code == 404
    assert "herbs" in response.json()["detail"]


def test_predict_zero_stress_gives_full_growth_rate(client):
    body = client.post("/api/sim/predict", json=ZERO_STRESS_LETTUCE).json()
    assert body["stress_factor"] == 0.0
    assert body["growth_rate"] == 1.0


def test_predict_growth_rate_bounded_0_1(client):
    for payload in (ZERO_STRESS_LETTUCE, IDEAL_LETTUCE, POOR_LETTUCE):
        rate = client.post("/api/sim/predict", json=payload).json()["growth_rate"]
        assert 0.0 <= rate <= 1.0


def test_predict_stress_slows_growth(client):
    ideal = client.post("/api/sim/predict", json=IDEAL_LETTUCE).json()
    poor = client.post("/api/sim/predict", json=POOR_LETTUCE).json()
    assert poor["growth_rate"] < ideal["growth_rate"]


def test_predict_growth_rate_tracks_stress(client):
    """The router must not re-derive the growth formula — it must match the engine's."""
    for payload in (ZERO_STRESS_LETTUCE, IDEAL_LETTUCE, POOR_LETTUCE):
        body = client.post("/api/sim/predict", json=payload).json()
        assert body["growth_rate"] == 1 - body["stress_factor"] / 100


def test_predict_cycle_days_is_crop_specific(client):
    lettuce = client.post("/api/sim/predict", json=IDEAL_LETTUCE).json()
    tomato = client.post(
        "/api/sim/predict",
        json={"crop_type": "tomatoes", "ph": 6.0, "air_temperature_c": 26.0, "humidity_percent": 70.0},
    ).json()
    assert lettuce["cycle_days"] == 45.0
    assert tomato["cycle_days"] == 120.0
