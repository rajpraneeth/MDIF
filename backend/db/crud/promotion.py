"""Environment-promotion CRUD (PROJECT_SPEC §5 Promotions, §9)."""
from __future__ import annotations

from db.crud.base import CRUDBase
from db.models.env_promotion import EnvPromotion


class CRUDPromotion(CRUDBase[EnvPromotion]):
    pass


crud_promotion = CRUDPromotion(EnvPromotion)
