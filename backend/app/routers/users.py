from uuid import uuid4

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

from app.db import query_all, query_one

router = APIRouter(prefix="/api/users", tags=["users"])


class UserCreate(BaseModel):
	email: str
	cognito_sub: str | None = None


class UserUpdate(BaseModel):
	email: str | None = None
	is_active: bool | None = None


@router.post("")
async def create_user(payload: UserCreate):
	try:
		existing = query_one("SELECT id FROM users WHERE email = %s;", (payload.email,))
		if existing:
			raise HTTPException(status_code=409, detail="User with this email already exists")

		user_id = str(uuid4())
		user = query_one(
			"""
			INSERT INTO users (id, cognito_sub, email)
			VALUES (%s, %s, %s)
			RETURNING id, cognito_sub, email, is_active, created_at, updated_at;
			""",
			(user_id, payload.cognito_sub, payload.email),
		)
		return user
	except HTTPException:
		raise
	except Exception as exc:
		raise HTTPException(status_code=500, detail=f"Failed to create user: {exc}")


@router.get("")
async def list_users(limit: int = Query(default=20, ge=1, le=200), offset: int = Query(default=0, ge=0)):
	try:
		return query_all(
			"""
			SELECT id, cognito_sub, email, is_active, created_at, updated_at
			FROM users
			ORDER BY created_at DESC
			LIMIT %s OFFSET %s;
			""",
			(limit, offset),
		)
	except Exception as exc:
		raise HTTPException(status_code=500, detail=f"Failed to list users: {exc}")


@router.get("/{user_id}")
async def get_user(user_id: str):
	try:
		user = query_one(
			"""
			SELECT id, cognito_sub, email, is_active, created_at, updated_at
			FROM users
			WHERE id = %s;
			""",
			(user_id,),
		)
		if not user:
			raise HTTPException(status_code=404, detail="User not found")
		return user
	except HTTPException:
		raise
	except Exception as exc:
		raise HTTPException(status_code=500, detail=f"Failed to fetch user: {exc}")


@router.patch("/{user_id}")
async def update_user(user_id: str, payload: UserUpdate):
	if payload.email is None and payload.is_active is None:
		raise HTTPException(status_code=400, detail="No fields provided for update")

	updates = []
	params: list[object] = []

	if payload.email is not None:
		updates.append("email = %s")
		params.append(payload.email)

	if payload.is_active is not None:
		updates.append("is_active = %s")
		params.append(payload.is_active)

	updates.append("updated_at = NOW()")
	params.append(user_id)

	sql = f"""
		UPDATE users
		SET {', '.join(updates)}
		WHERE id = %s
		RETURNING id, cognito_sub, email, is_active, created_at, updated_at;
	"""

	try:
		user = query_one(sql, tuple(params))
		if not user:
			raise HTTPException(status_code=404, detail="User not found")
		return user
	except HTTPException:
		raise
	except Exception as exc:
		raise HTTPException(status_code=500, detail=f"Failed to update user: {exc}")