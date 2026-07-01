import unittest
from unittest.mock import Mock, patch
from datetime import datetime

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from src.core.enums import MembershipRole
from src.modules.auth.models import User
from src.modules.project_membership.models import ProjectMembership
from src.modules.projects import services
from src.modules.projects.models import Project
from src.modules.projects.exceptions import (
    ProjectAlreadyExistsError,
    ProjectNotFoundError,
    UserNotFoundError,
    OwnerCannotLeaveError,
)


class SimpleUser:
    def __init__(self):
        self.id = "admin-id"
        self.email = "admin@example.com"
        self.username = "admin"
        self.is_active = True


class SimpleProject:
    def __init__(
        self,
        project_id="proj-123",
        name="project-1",
        admin_id="admin-id",
        description=None,
    ):
        self.id = project_id
        self.name = name
        self.description = description
        self.admin_id = admin_id
        self.is_finished = False
        self.user_role: MembershipRole | None = None

        # New required fields
        self.documents_count = 0
        self.total_size_bytes = 0
        self.created_at = datetime.utcnow()
        self.updated_at = datetime.utcnow()

        # Depends on your schema
        self.admin = SimpleUser()


def make_user(user_id="admin-id", email="admin@test.com"):
    user = Mock()
    user.id = user_id
    user.email = email
    user.hashed_password = "secret"
    user.is_active = True
    return user


def make_query(result=None):
    query = Mock()
    query.filter.return_value = query
    query.one_or_none.return_value = result
    query.all.return_value = result
    return query


class ProjectServiceUnitTests(unittest.TestCase):
    def setUp(self):
        self.db = Mock()
        self.db.add = Mock()
        self.db.commit = Mock()
        self.db.rollback = Mock()
        self.db.refresh = Mock()
        self.db.delete = Mock()
        self.db.query.return_value = make_query()
        self.redis_patcher = patch("src.modules.projects.services.redis_client")
        self.mock_redis = self.redis_patcher.start()
        self.mock_redis.get.return_value = None

    def tearDown(self):
        self.redis_patcher.stop()

    def test_get_project_by_name_returns_matching_project(self):
        expected = SimpleProject(name="project-1")
        self.db.query.return_value = make_query(expected)

        project = services.get_project_by_name(self.db, "project-1")

        self.assertIs(project, expected)
        self.db.query.assert_called_once()

    @patch("src.modules.projects.services.TypeAdapter")
    def test_get_all_projects_returns_project_list(self, mock_type_adapter):
        projects = [SimpleProject("proj-1"), SimpleProject("proj-2")]
        memberships = [
            Mock(project_id="proj-1", role=MembershipRole.OWNER),
            Mock(project_id="proj-2", role=MembershipRole.PARTICIPANT),
        ]

        # Pierwsze query: Project -> join -> filter -> distinct -> all
        projects_query = Mock()
        projects_query.join.return_value = projects_query
        projects_query.filter.return_value = projects_query
        projects_query.distinct.return_value = projects_query
        projects_query.all.return_value = projects

        # Drugie query: ProjectMembership -> filter (iterowane bez .all())
        memberships_query = Mock()
        memberships_query.filter.return_value = memberships

        self.db.query.side_effect = [projects_query, memberships_query]

        expected_serialized = [{"id": "proj-1"}, {"id": "proj-2"}]
        mock_adapter = Mock()
        mock_type_adapter.return_value = mock_adapter
        mock_adapter.validate_python.return_value = projects
        mock_adapter.dump_python.return_value = expected_serialized

        result = services.get_all_projects(self.db, "admin-id")

        self.assertEqual(result, expected_serialized)
        self.mock_redis.get.assert_called_once_with("user:admin-id:projects")
        self.mock_redis.setex.assert_called_once()

    def test_get_all_projects_returns_cached_projects(self):
        import json

        expected_serialized = [{"id": "proj-1"}, {"id": "proj-2"}]
        self.mock_redis.get.return_value = json.dumps(expected_serialized)

        result = services.get_all_projects(self.db, "admin-id")

        self.assertEqual(result, expected_serialized)
        self.mock_redis.get.assert_called_once_with("user:admin-id:projects")
        self.db.query.assert_not_called()

    def test_create_project_raises_when_name_already_exists(self):
        user = make_user()
        self.db.query.return_value = make_query(user)
        with patch.object(services, "get_project_by_name", return_value=Mock()):
            with self.assertRaises(ProjectAlreadyExistsError):
                services.create_project(self.db, "project-1", "admin-id")

    def test_create_project_does_not_require_user_lookup(self):
        with patch.object(services, "get_project_by_name", return_value=None):
            project = services.create_project(self.db, "project-1", "admin-id")

        self.assertEqual(project.name, "project-1")
        self.assertEqual(project.user_role, MembershipRole.OWNER)

    def test_create_project_commits_and_returns_project(self):
        user = make_user()
        self.db.query.return_value = make_query(user)
        with patch.object(services, "get_project_by_name", return_value=None):
            project = services.create_project(
                self.db,
                "project-1",
                "admin-id",
                description="a project",
            )

        self.assertEqual(project.name, "project-1")
        self.assertEqual(project.description, "a project")
        self.assertEqual(project.admin_id, "admin-id")
        self.assertEqual(project.user_role, MembershipRole.OWNER)
        self.db.commit.assert_called_once()
        self.db.refresh.assert_called_once_with(project)

    def test_update_project_raises_when_not_found(self):
        with patch.object(services, "get_project_by_id", return_value=None):
            with self.assertRaises(ProjectNotFoundError):
                services.update_project(self.db, "missing-id", name="x")

    def test_update_project_raises_when_duplicate_name(self):
        project = SimpleProject()
        other_project = SimpleProject(project_id="proj-2", name="existing-name")
        with (
            patch.object(services, "get_project_by_id", return_value=project),
            patch.object(services, "get_project_by_name", return_value=other_project),
        ):
            with self.assertRaises(ProjectAlreadyExistsError):
                services.update_project(self.db, project.id, name="existing-name")

    def test_update_project_changes_fields(self):
        project = SimpleProject()
        with (
            patch.object(services, "get_project_by_id", return_value=project),
            patch.object(services, "get_project_by_name", return_value=None),
        ):
            updated = services.update_project(
                self.db,
                project.id,
                name="project-2",
                description="updated",
                is_finished=True,
            )

        self.assertEqual(updated.name, "project-2")
        self.assertEqual(updated.description, "updated")
        self.assertTrue(updated.is_finished)
        self.db.commit.assert_called_once()

    def test_delete_project_raises_when_not_found(self):
        with patch.object(services, "get_project_by_id", return_value=None):
            with self.assertRaises(ProjectNotFoundError):
                services.delete_project(self.db, "missing-id")

    def test_delete_project_commits_and_returns_message(self):
        project = SimpleProject()
        with patch.object(services, "get_project_by_id", return_value=project):
            result = services.delete_project(self.db, project.id)

        self.db.delete.assert_called_once_with(project)
        self.db.commit.assert_called_once()
        self.assertEqual(result, {"message": "Project deleted successfully"})

    def test_add_user_to_project_raises_when_project_missing(self):
        with patch.object(services, "get_project_by_id", return_value=None):
            with self.assertRaises(ProjectNotFoundError):
                services.add_user_to_project(self.db, "user-2", "missing-id")

    def test_add_user_to_project_raises_when_user_missing(self):
        project = SimpleProject()
        self.db.query.return_value = make_query(None)
        with patch.object(services, "get_project_by_id", return_value=project):
            with self.assertRaises(UserNotFoundError):
                services.add_user_to_project(self.db, "missing-user", project.id)

    def test_add_user_to_project_appends_user(self):
        project = SimpleProject()
        user = make_user(user_id="user-2")
        self.db.query.return_value = make_query(user)
        with patch.object(services, "get_project_by_id", return_value=project):
            updated = services.add_user_to_project(self.db, "user-2", project.id)

        self.db.commit.assert_called_once()
        self.assertEqual(updated.id, project.id)

    def test_leave_project_raises_when_project_missing(self):
        # Arrange — the project lookup finds nothing
        self.db.query.return_value = make_query(None)

        # Act / Assert — leaving a non-existent project is an error
        with self.assertRaises(ProjectNotFoundError):
            services.leave_project(self.db, "missing-id", "user-2")

    def test_leave_project_raises_when_owner_leaves(self):
        # Arrange — a project whose owner is the user trying to leave
        project = SimpleProject(admin_id="owner-id")
        self.db.query.return_value = make_query(project)

        # Act / Assert — the owner is not allowed to leave their own project
        with self.assertRaises(OwnerCannotLeaveError):
            services.leave_project(self.db, project.id, "owner-id")

    def test_leave_project_removes_membership_and_user(self):
        # Arrange — project lookup, membership lookup, then all-memberships lookup
        project = SimpleProject(admin_id="owner-id")
        membership = Mock(user_id="user-2")
        all_memberships = [Mock(user_id="owner-id"), Mock(user_id="user-2")]
        self.db.query.side_effect = [
            make_query(project),
            make_query(membership),
            make_query(all_memberships),
        ]

        # Act
        services.leave_project(self.db, project.id, "user-2")

        # Assert — the membership row is deleted
        self.db.delete.assert_called_once_with(membership)
        self.db.commit.assert_called_once()

    def test_leave_project_invalidates_every_member_cache(self):
        # Arrange — a project with the owner and the leaving participant.
        project = SimpleProject(admin_id="owner-id")
        membership = Mock(user_id="user-2")
        all_memberships = [Mock(user_id="owner-id"), Mock(user_id="user-2")]
        self.db.query.side_effect = [
            make_query(project),
            make_query(membership),
            make_query(all_memberships),
        ]

        # Act
        services.leave_project(self.db, project.id, "user-2")

        # Assert — the remaining owner's cached list is busted too, not just the leaver's
        self.mock_redis.delete.assert_any_call("user:user-2:projects")
        self.mock_redis.delete.assert_any_call("user:owner-id:projects")


# ---------------------------------------------------------------------------
# Integration tests — POST /project/{project_id}/leave (route + RBAC)
# ---------------------------------------------------------------------------


class TestLeaveProjectEndpoint:
    @pytest.fixture(autouse=True)
    def _mock_redis(self):
        with patch("src.modules.projects.services.redis_client") as mock:
            mock.get.return_value = None
            yield mock

    @pytest.fixture
    def auth_as(self):
        from src.main import app
        from src.core.security import get_current_user

        def _set(user_id: str):
            app.dependency_overrides[get_current_user] = lambda: user_id

        yield _set
        app.dependency_overrides.pop(get_current_user, None)

    @pytest.fixture
    def project_with_members(self, db: Session) -> Project:
        owner = User(id="leave-owner", email="leave-owner@x.com", hashed_password="x")
        participant = User(
            id="leave-part", email="leave-part@x.com", hashed_password="x"
        )
        db.add_all([owner, participant])
        db.flush()
        project = Project(name="leave-endpoint-project", admin_id=owner.id)
        db.add(project)
        db.flush()
        db.add_all(
            [
                ProjectMembership(
                    project_id=project.id, user_id=owner.id, role=MembershipRole.OWNER
                ),
                ProjectMembership(
                    project_id=project.id,
                    user_id=participant.id,
                    role=MembershipRole.PARTICIPANT,
                ),
            ]
        )
        db.flush()
        return project

    def test_participant_can_leave_returns_204(
        self, client: TestClient, db: Session, project_with_members: Project, auth_as
    ):
        # Arrange — act as the participant (project seeded by the fixture)
        auth_as("leave-part")

        # Act
        response = client.post(f"/project/{project_with_members.id}/leave")

        # Assert — success, and the participant's membership row is gone
        assert response.status_code == 204
        membership = (
            db.query(ProjectMembership)
            .filter(
                ProjectMembership.project_id == project_with_members.id,
                ProjectMembership.user_id == "leave-part",
            )
            .one_or_none()
        )
        assert membership is None

    def test_owner_cannot_leave_returns_403(
        self, client: TestClient, project_with_members: Project, auth_as
    ):
        # Arrange — act as the owner
        auth_as("leave-owner")

        # Act
        response = client.post(f"/project/{project_with_members.id}/leave")

        # Assert — the owner cannot leave their own project
        assert response.status_code == 403

    def test_non_member_cannot_leave_returns_403(
        self, client: TestClient, db: Session, project_with_members: Project, auth_as
    ):
        # Arrange — a user who is not a member of the project
        outsider = User(id="leave-outsider", email="out@x.com", hashed_password="x")
        db.add(outsider)
        db.flush()
        auth_as("leave-outsider")

        # Act
        response = client.post(f"/project/{project_with_members.id}/leave")

        # Assert — non-members are denied
        assert response.status_code == 403

    def test_leave_without_token_returns_401(
        self, client: TestClient, project_with_members: Project
    ):
        # Arrange — no auth override applied, so the request carries no token

        # Act
        response = client.post(f"/project/{project_with_members.id}/leave")

        # Assert — unauthenticated requests are rejected
        assert response.status_code == 401


if __name__ == "__main__":
    unittest.main()
