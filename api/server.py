"""FastAPI server for auth, profiles, and global scoring weights."""

from __future__ import annotations

from fastapi import Depends, FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from api.auth import (
    AuthUser,
    LoginRequest,
    TokenResponse,
    authenticate_user,
    create_access_token,
    get_current_user,
    require_admin,
)
from api.scoring import (
    apply_weights_to_profile,
    apply_weights_to_profiles,
    classification_counts,
    load_profiles,
    load_weights,
    save_weights,
    validate_weights,
)
from api.llm import ClientAIReport, generate_client_report

app = FastAPI(title="Portfolio Drift API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:4173", "http://127.0.0.1:4173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class ComponentWeights(BaseModel):
    driftSeverity: float = Field(ge=0, le=1)
    persistence: float = Field(ge=0, le=1)
    velocity: float = Field(ge=0, le=1)
    moneyImpact: float = Field(ge=0, le=1)
    concentration: float = Field(ge=0, le=1)


class WeightsUpdateResponse(BaseModel):
    weights: ComponentWeights
    classificationCounts: dict[str, int]
    previousClassificationCounts: dict[str, int]


def weights_to_dict(weights: ComponentWeights) -> dict[str, float]:
    return weights.model_dump()


def find_profile_by_identifier(identifier: str) -> dict:
    weights = load_weights()
    profiles = load_profiles()
    for raw in profiles:
        if raw.get("identifier") == identifier:
            return apply_weights_to_profile(raw, weights)
    raise HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail=f"Client '{identifier}' not found",
    )


class ClientReportResponse(BaseModel):
    profile: dict
    weights: ComponentWeights
    report: ClientAIReport
    cached: bool


@app.get("/api/profiles/{identifier}")
def get_profile(
    identifier: str,
    _user: AuthUser = Depends(get_current_user),
) -> dict:
    return find_profile_by_identifier(identifier)


@app.get("/api/profiles/{identifier}/report", response_model=ClientReportResponse)
def get_client_report(
    identifier: str,
    force: bool = False,
    _user: AuthUser = Depends(get_current_user),
) -> ClientReportResponse:
    profile = find_profile_by_identifier(identifier)
    weights = load_weights()
    try:
        report, from_cache = generate_client_report(profile, weights, force=force)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(exc),
        ) from exc
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Failed to generate report: {exc}",
        ) from exc
    return ClientReportResponse(
        profile=profile,
        weights=ComponentWeights(**weights),
        report=report,
        cached=from_cache,
    )


@app.post("/api/profiles/{identifier}/report", response_model=ClientReportResponse)
def regenerate_client_report(
    identifier: str,
    _user: AuthUser = Depends(get_current_user),
) -> ClientReportResponse:
    return get_client_report(identifier, force=True, _user=_user)


@app.post("/api/auth/login", response_model=TokenResponse)
def login(request: LoginRequest) -> TokenResponse:
    user = authenticate_user(request.username, request.password)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password",
        )
    token = create_access_token(user)
    return TokenResponse(access_token=token, user=user)


@app.get("/api/auth/me", response_model=AuthUser)
def me(user: AuthUser = Depends(get_current_user)) -> AuthUser:
    return user


@app.get("/api/weights", response_model=ComponentWeights)
def get_weights(_user: AuthUser = Depends(get_current_user)) -> ComponentWeights:
    return ComponentWeights(**load_weights())


@app.put("/api/weights", response_model=WeightsUpdateResponse)
def update_weights(
    weights: ComponentWeights,
    _admin: AuthUser = Depends(require_admin),
) -> WeightsUpdateResponse:
    weights_dict = weights_to_dict(weights)
    try:
        validate_weights(weights_dict)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc

    current_weights = load_weights()
    raw_profiles = load_profiles()
    previous_profiles = apply_weights_to_profiles(raw_profiles, current_weights)
    previous_counts = classification_counts(previous_profiles)

    save_weights(weights_dict)
    updated_profiles = apply_weights_to_profiles(raw_profiles, weights_dict)
    new_counts = classification_counts(updated_profiles)

    return WeightsUpdateResponse(
        weights=weights,
        classificationCounts=new_counts,
        previousClassificationCounts=previous_counts,
    )


@app.get("/api/profiles")
def get_profiles(_user: AuthUser = Depends(get_current_user)) -> list[dict]:
    weights = load_weights()
    profiles = load_profiles()
    return apply_weights_to_profiles(profiles, weights)
