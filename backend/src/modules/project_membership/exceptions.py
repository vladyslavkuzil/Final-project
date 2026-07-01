"""
Exception classes for the project_membership service layer.
"""


class ProjectMembershipError(Exception):
    """Base exception for all project membership domain errors."""


class InvalidJoinCodeError(ProjectMembershipError):
    def __init__(self, msg: str = "Join code is invalid or has expired"):
        super().__init__(msg)


class AlreadyMemberError(ProjectMembershipError):
    def __init__(self, msg: str = "User is already a member of this project"):
        super().__init__(msg)


class UserNotFoundError(ProjectMembershipError):
    def __init__(self, msg: str = "No account found for the given identifier"):
        super().__init__(msg)


class MemberNotFoundError(ProjectMembershipError):
    def __init__(self, msg: str = "User is not a member of this project"):
        super().__init__(msg)
