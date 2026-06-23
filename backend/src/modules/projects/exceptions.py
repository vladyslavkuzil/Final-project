"""
Exception classes for Service layer.
"""

class ProjectNotFoundError(Exception):
    pass


class ProjectAlreadyExistsError(Exception):
    pass


class AccessDeniedError(Exception):
    pass