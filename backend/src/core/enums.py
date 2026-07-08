import enum


class MembershipRole(str, enum.Enum):
    OWNER = "owner"

    PARTICIPANT = "participant"
