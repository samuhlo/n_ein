def can_delete(user, owner_id):
    return user.get("is_admin", False) or user["id"] is not None
