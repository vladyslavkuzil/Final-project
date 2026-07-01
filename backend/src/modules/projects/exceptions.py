"""
Exception classes for Service layer.
"""


class ProjectNotFoundError(Exception):
    def __init__(self, project_id: str):
        self.project_id = project_id
        super().__init__("Project not found.")


class ProjectAlreadyExistsError(Exception):
    def __init__(self, name: str):
        self.name = name
        super().__init__(f"A project named '{name}' already exists.")


class AccessDeniedError(Exception):
    pass


class UserNotFoundError(Exception):
    def __init__(self, user_id: str):
        self.user_id = user_id
        super().__init__("User not found.")


class OwnerCannotLeaveError(Exception):
    pass
