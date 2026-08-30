from collections.abc import Callable

from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import decode_access_token
from app.models import User


bearer = HTTPBearer(auto_error=False)


def current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer),
    database: Session = Depends(get_db),
) -> User:
    user_id = decode_access_token(credentials.credentials) if credentials else None
    user = database.get(User, user_id) if user_id else None
    if not user or not user.is_active:
        raise HTTPException(status_code=401, detail="A valid signed-in session is required.", headers={"WWW-Authenticate": "Bearer"})
    return user


def require_roles(*allowed: str) -> Callable:
    def dependency(user: User = Depends(current_user)) -> User:
        roles = {role.name for role in user.roles}
        if roles.isdisjoint(allowed):
            raise HTTPException(status_code=403, detail="Your assigned role does not permit this action.")
        return user
    return dependency
