"""
House Service - Business Logic Layer
Handles all business logic for house management and invitations.

This service layer separates business logic from API endpoints, making the code:
- More testable (can test logic without HTTP layer)
- More reusable (can call from multiple endpoints or background tasks)
- Easier to maintain (logic changes don't affect API structure)

Key responsibilities:
- CRUD operations for houses
- Membership management (add/remove members)
- Invitation system (generate codes, validate, redeem)
- Permission checks (owner-only operations)
"""

from sqlalchemy.orm import Session
from sqlalchemy import and_, or_
from typing import List, Optional, Dict
from datetime import datetime, timedelta, timezone
from uuid import UUID
import random
import string

from app.models.house import House
from app.models.user_house import UserHouse
from app.models.house_invite import HouseInvite
from app.models.user import User
from app.schemas.house import (
    HouseCreate,
    HouseUpdate,
    HouseResponse,
    HouseDetailResponse,
    HouseMemberResponse,
    HouseInviteResponse
)


class HouseService:
    """
    Service class for house-related business logic.

    All methods take a database session as parameter for transaction control.
    The caller (usually API endpoint) is responsible for committing/rolling back.
    """

    @staticmethod
    def create_house(
        db: Session,
        house_data: HouseCreate,
        owner_id: UUID
    ) -> House:
        """
        Create a new house with the given user as owner.

        Steps:
        1. Create house record
        2. Add creator as OWNER in user_house table
        3. Return created house

        Args:
            db: Database session
            house_data: House creation data
            owner_id: ID of user creating the house

        Returns:
            Created House object

        Example:
            house = HouseService.create_house(
                db=db,
                house_data=HouseCreate(name="Casa Rossi"),
                owner_id=current_user.id
            )
        """
        # Create house record
        house = House(
            owner_id=owner_id,
            name=house_data.name,
            description=house_data.description,
            location=house_data.location,
            settings=house_data.settings or {}
        )
        db.add(house)
        db.flush()  # Get house.id without committing

        # Add owner to house members
        membership = UserHouse(
            user_id=owner_id,
            house_id=house.id,
            role="OWNER"
        )
        db.add(membership)
        db.flush()

        return house

    @staticmethod
    def get_user_houses(db: Session, user_id: UUID) -> List[House]:
        """
        Get all houses a user belongs to.

        Queries user_house table to find all memberships,
        then returns the corresponding house objects.

        Args:
            db: Database session
            user_id: ID of user to get houses for

        Returns:
            List of House objects user is a member of

        Example:
            houses = HouseService.get_user_houses(db, current_user.id)
        """
        # Query houses through user_house association
        memberships = db.query(UserHouse).filter(
            UserHouse.user_id == user_id
        ).all()

        house_ids = [m.house_id for m in memberships]

        houses = db.query(House).filter(
            House.id.in_(house_ids)
        ).all()

        return houses

    @staticmethod
    def get_house_by_id(db: Session, house_id: UUID) -> Optional[House]:
        """
        Get house by ID.

        Args:
            db: Database session
            house_id: House ID to retrieve

        Returns:
            House object if found, None otherwise
        """
        return db.query(House).filter(House.id == house_id).first()

    @staticmethod
    def get_house_with_members(
        db: Session,
        house_id: UUID
    ) -> Optional[Dict]:
        """
        Get house details including all members.

        Returns house info along with member list (user info + role).

        Args:
            db: Database session
            house_id: House ID to retrieve

        Returns:
            Dictionary with house data and members list, or None if not found

        Example:
            {
                "house": House object,
                "members": [
                    {
                        "user": User object,
                        "membership": UserHouse object
                    },
                    ...
                ]
            }
        """
        house = db.query(House).filter(House.id == house_id).first()
        if not house:
            return None

        # Get all memberships for this house
        memberships = db.query(UserHouse).filter(
            UserHouse.house_id == house_id
        ).all()

        # Get user info for each member
        members_data = []
        for membership in memberships:
            user = db.query(User).filter(User.id == membership.user_id).first()
            if user:
                members_data.append({
                    "user": user,
                    "membership": membership
                })

        return {
            "house": house,
            "members": members_data
        }

    @staticmethod
    def update_house(
        db: Session,
        house_id: UUID,
        house_data: HouseUpdate,
        user_id: UUID
    ) -> Optional[House]:
        """
        Update house information.

        Only the house owner can update house settings.

        Args:
            db: Database session
            house_id: House ID to update
            house_data: Update data (only provided fields will be updated)
            user_id: ID of user attempting the update

        Returns:
            Updated House object if successful, None if not found or unauthorized

        Raises:
            PermissionError: If user is not the house owner
        """
        house = db.query(House).filter(House.id == house_id).first()
        if not house:
            return None

        # Check if user is owner
        if house.owner_id != user_id:
            raise PermissionError("Only house owner can update house settings")

        # Update only provided fields
        update_data = house_data.dict(exclude_unset=True)
        for field, value in update_data.items():
            setattr(house, field, value)

        db.flush()
        return house

    @staticmethod
    def delete_house(
        db: Session,
        house_id: UUID,
        user_id: UUID
    ) -> bool:
        """
        Delete a house.

        Only the house owner can delete the house.
        Deletion cascades to memberships, invites, recipes, and meals.

        Args:
            db: Database session
            house_id: House ID to delete
            user_id: ID of user attempting deletion

        Returns:
            True if deleted, False if not found

        Raises:
            PermissionError: If user is not the house owner
        """
        house = db.query(House).filter(House.id == house_id).first()
        if not house:
            return False

        # Check if user is owner
        if house.owner_id != user_id:
            raise PermissionError("Only house owner can delete the house")

        db.delete(house)
        db.flush()
        return True

    @staticmethod
    def check_user_membership(
        db: Session,
        user_id: UUID,
        house_id: UUID
    ) -> Optional[UserHouse]:
        """
        Check if user is a member of a house.

        Args:
            db: Database session
            user_id: User ID to check
            house_id: House ID to check

        Returns:
            UserHouse membership object if member, None otherwise
        """
        return db.query(UserHouse).filter(
            and_(
                UserHouse.user_id == user_id,
                UserHouse.house_id == house_id
            )
        ).first()

    @staticmethod
    def generate_invite_code() -> str:
        """
        Generate a unique 6-character invitation code.

        Format: uppercase letters and numbers (A-Z, 0-9)
        Example: "ABC123", "K4T2M9"

        Returns:
            6-character alphanumeric string

        Note: Caller should check for uniqueness in database
        """
        return ''.join(random.choices(
            string.ascii_uppercase + string.digits,
            k=6
        ))

    @staticmethod
    def create_invite(
        db: Session,
        house_id: UUID,
        created_by: UUID
    ) -> HouseInvite:
        """
        Create a new invitation code for a house.

        Steps:
        1. Generate unique 6-character code
        2. Set expiration to 7 days from now
        3. Save invitation record

        Args:
            db: Database session
            house_id: House to create invitation for
            created_by: User creating the invitation

        Returns:
            Created HouseInvite object

        Note: Regenerates code if collision occurs (very unlikely)
        """
        # Generate unique code
        code = HouseService.generate_invite_code()

        # Check for collisions (very unlikely with 36^6 combinations)
        while db.query(HouseInvite).filter(HouseInvite.code == code).first():
            code = HouseService.generate_invite_code()

        # Create invite with 7-day expiration
        invite = HouseInvite(
            house_id=house_id,
            code=code,
            created_by=created_by,
            expires_at=datetime.now(timezone.utc) + timedelta(days=7)
        )
        db.add(invite)
        db.flush()

        return invite

    @staticmethod
    def validate_and_use_invite(
        db: Session,
        invite_code: str,
        user_id: UUID
    ) -> Optional[House]:
        """
        Validate invitation code and add user to house.

        Steps:
        1. Find invitation by code
        2. Check if valid (not used, not expired)
        3. Mark as used
        4. Add user to house as MEMBER
        5. Return house object

        Args:
            db: Database session
            invite_code: 6-character invitation code
            user_id: User redeeming the invitation

        Returns:
            House object if successful, None if invalid code

        Raises:
            ValueError: If invitation is expired or already used
        """
        # Find invitation
        invite = db.query(HouseInvite).filter(
            HouseInvite.code == invite_code.upper()
        ).first()

        if not invite:
            return None

        # Check if already used
        if invite.used_by is not None:
            raise ValueError("This invitation has already been used")

        # Check if expired
        if invite.expires_at <= datetime.now(timezone.utc):
            raise ValueError("This invitation has expired")

        # Check if user is already a member
        existing_membership = db.query(UserHouse).filter(
            and_(
                UserHouse.user_id == user_id,
                UserHouse.house_id == invite.house_id
            )
        ).first()

        if existing_membership:
            raise ValueError("You are already a member of this house")

        # Mark invite as used
        invite.used_by = user_id

        # Add user to house as MEMBER
        membership = UserHouse(
            user_id=user_id,
            house_id=invite.house_id,
            role="MEMBER"
        )
        db.add(membership)
        db.flush()

        # Get and return house
        house = db.query(House).filter(House.id == invite.house_id).first()
        return house

    @staticmethod
    def remove_member(
        db: Session,
        house_id: UUID,
        user_id_to_remove: UUID,
        requester_id: UUID
    ) -> bool:
        """
        Remove a member from a house.

        Only the house owner can remove members.
        Owner cannot remove themselves.

        Args:
            db: Database session
            house_id: House ID
            user_id_to_remove: ID of user to remove
            requester_id: ID of user making the request

        Returns:
            True if removed, False if not found

        Raises:
            PermissionError: If requester is not owner or trying to remove owner
        """
        house = db.query(House).filter(House.id == house_id).first()
        if not house:
            return False

        # Check if requester is owner
        if house.owner_id != requester_id:
            raise PermissionError("Only house owner can remove members")

        # Cannot remove owner
        if user_id_to_remove == house.owner_id:
            raise PermissionError("Cannot remove house owner")

        # Find and delete membership
        membership = db.query(UserHouse).filter(
            and_(
                UserHouse.user_id == user_id_to_remove,
                UserHouse.house_id == house_id
            )
        ).first()

        if not membership:
            return False

        db.delete(membership)
        db.flush()
        return True
