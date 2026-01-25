"""
HouseInvite Model
Manages invitation codes for joining houses.

This model implements a secure invitation system where:
- House owners/members can generate unique 6-character codes
- Codes expire after 7 days for security
- Each code can only be used once
- Tracks who created the invite and who used it

The invitation flow:
1. Existing member generates an invite code
2. Code is shared externally (WhatsApp, Telegram, email, etc)
3. New user registers and uses code to join
4. Code is marked as used and cannot be reused
"""

from sqlalchemy import Column, String, DateTime, ForeignKey, func, Index
from sqlalchemy.dialects.postgresql import UUID

from app.models.base import BaseModel


class HouseInvite(BaseModel):
    """
    House invitation model for secure member onboarding.

    Fields:
        id (UUID): Primary key, inherited from BaseModel
        house_id (UUID): Foreign key to houses table
        code (str): Unique 6-character alphanumeric code
        created_by (UUID): User who generated this invite
        used_by (UUID): User who used this invite (null if unused)
        expires_at (datetime): Expiration timestamp (7 days from creation)
        created_at (datetime): Invite creation timestamp
        updated_at (datetime): Last modification timestamp

    Code format:
        - 6 characters: uppercase letters and numbers (A-Z, 0-9)
        - Example: "ABC123", "XYZ789", "K4T2M9"
        - Total combinations: 36^6 = 2.1 billion codes
        - Collision probability is negligible

    Security features:
        - Codes expire after 7 days to limit exposure
        - Each code is single-use (marked as used after first redemption)
        - Unique constraint prevents duplicate codes
        - Indexed for fast lookup during redemption

    Example usage:
        # Generate invite
        import random
        import string
        from datetime import datetime, timedelta

        code = ''.join(random.choices(string.ascii_uppercase + string.digits, k=6))
        invite = HouseInvite(
            house_id=house.id,
            code=code,
            created_by=current_user.id,
            expires_at=datetime.utcnow() + timedelta(days=7)
        )
        db.add(invite)
        db.commit()

        # Redeem invite
        invite = db.query(HouseInvite).filter(
            HouseInvite.code == "ABC123",
            HouseInvite.used_by.is_(None),
            HouseInvite.expires_at > datetime.utcnow()
        ).first()

        if invite:
            invite.used_by = new_user.id
            # Add user to house via UserHouse
            db.commit()
    """

    __tablename__ = "house_invites"

    # House reference
    # The house this invitation is for
    house_id = Column(
        UUID(as_uuid=True),
        ForeignKey("houses.id", ondelete="CASCADE"),  # Delete invite if house deleted
        nullable=False,
        index=True,
        comment="House this invitation is for"
    )

    # Invitation code
    # 6 characters, unique across all invitations
    # Indexed for fast lookups during redemption
    code = Column(
        String(6),
        unique=True,  # Ensure no duplicate codes
        nullable=False,
        index=True,  # Fast lookups by code
        comment="Unique 6-character invitation code"
    )

    # Creator reference
    # User who generated this invitation
    # Must be a member of the house
    created_by = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),  # Delete invite if creator deleted
        nullable=False,
        index=True,
        comment="User who created this invitation"
    )

    # Redeemer reference
    # User who used this invitation to join
    # Null until the invitation is redeemed
    used_by = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),  # Keep record even if user deleted
        nullable=True,
        index=True,
        comment="User who used this invitation (null if unused)"
    )

    # Expiration timestamp
    # Typically set to 7 days from creation
    # Expired invitations cannot be redeemed
    expires_at = Column(
        DateTime(timezone=True),
        nullable=False,
        index=True,  # Index for efficient expiration queries
        comment="When this invitation expires (UTC)"
    )

    # Composite index for common query pattern:
    # Find valid (unused, not expired) invitations by code
    __table_args__ = (
        Index(
            'idx_invite_code_valid',
            code,
            used_by,
            expires_at
        ),
    )

    # Relationships
    # house = relationship("House", back_populates="invites")
    # creator = relationship("User", foreign_keys=[created_by])
    # redeemer = relationship("User", foreign_keys=[used_by])

    def __repr__(self):
        """String representation for debugging."""
        status = "used" if self.used_by else "active"
        return f"<HouseInvite(code={self.code}, house_id={self.house_id}, status={status})>"

    @property
    def is_valid(self) -> bool:
        """
        Check if invitation is still valid and can be redeemed.

        Returns:
            bool: True if invitation is unused and not expired
        """
        from datetime import datetime, timezone
        return (
            self.used_by is None and
            self.expires_at > datetime.now(timezone.utc)
        )

    @property
    def is_expired(self) -> bool:
        """Check if invitation has expired."""
        from datetime import datetime, timezone
        return self.expires_at <= datetime.now(timezone.utc)

    @property
    def is_used(self) -> bool:
        """Check if invitation has been redeemed."""
        return self.used_by is not None

    @property
    def days_until_expiry(self) -> int:
        """Get number of days until expiration."""
        from datetime import datetime, timezone
        if self.is_expired:
            return 0
        delta = self.expires_at - datetime.now(timezone.utc)
        return max(0, delta.days)
