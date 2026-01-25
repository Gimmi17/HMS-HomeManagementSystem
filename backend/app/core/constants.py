"""
Application Constants
Defines constant values used throughout the application.

This module contains all application-wide constants including:
- User roles
- Meal types
- Recipe difficulty levels
- Health record types
"""

# User Roles in House Membership
ROLE_OWNER = "OWNER"  # House owner, full permissions
ROLE_MEMBER = "MEMBER"  # Regular member, can create and view
ROLE_GUEST = "GUEST"  # Limited access, view-only

VALID_ROLES = [ROLE_OWNER, ROLE_MEMBER, ROLE_GUEST]

# Meal Types
MEAL_TYPE_BREAKFAST = "colazione"  # Breakfast
MEAL_TYPE_SNACK = "spuntino"  # Snack
MEAL_TYPE_LUNCH = "pranzo"  # Lunch
MEAL_TYPE_DINNER = "cena"  # Dinner

VALID_MEAL_TYPES = [
    MEAL_TYPE_BREAKFAST,
    MEAL_TYPE_SNACK,
    MEAL_TYPE_LUNCH,
    MEAL_TYPE_DINNER
]

# Recipe Difficulty Levels
DIFFICULTY_EASY = "easy"  # Simple recipes
DIFFICULTY_MEDIUM = "medium"  # Moderate complexity
DIFFICULTY_HARD = "hard"  # Complex recipes

VALID_DIFFICULTIES = [DIFFICULTY_EASY, DIFFICULTY_MEDIUM, DIFFICULTY_HARD]

# Health Record Types
HEALTH_TYPE_COLD = "cold"  # Common cold
HEALTH_TYPE_FLU = "flu"  # Influenza
HEALTH_TYPE_HEADACHE = "headache"  # Headache
HEALTH_TYPE_ALLERGY = "allergy"  # Allergic reaction
HEALTH_TYPE_INJURY = "injury"  # Physical injury
HEALTH_TYPE_OTHER = "other"  # Other health issues

VALID_HEALTH_TYPES = [
    HEALTH_TYPE_COLD,
    HEALTH_TYPE_FLU,
    HEALTH_TYPE_HEADACHE,
    HEALTH_TYPE_ALLERGY,
    HEALTH_TYPE_INJURY,
    HEALTH_TYPE_OTHER
]

# Health Record Severity
SEVERITY_MILD = "mild"  # Minor issues
SEVERITY_MODERATE = "moderate"  # Moderate discomfort
SEVERITY_SEVERE = "severe"  # Serious issues

VALID_SEVERITIES = [SEVERITY_MILD, SEVERITY_MODERATE, SEVERITY_SEVERE]

# Invite Code Settings
INVITE_CODE_LENGTH = 6  # Length of house invite codes
INVITE_CODE_EXPIRATION_DAYS = 7  # Days until invite code expires

# Pagination
DEFAULT_PAGE_SIZE = 50  # Default number of items per page
MAX_PAGE_SIZE = 100  # Maximum items per page
