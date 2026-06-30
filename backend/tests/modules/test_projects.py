import unittest
from unittest.mock import Mock, patch
from datetime import datetime
from src.core.enums import MembershipRole
from src.modules.projects import services
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
        self.users = []
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
        self.db.query.return_value = make_query(projects)

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

    def test_create_project_raises_when_user_not_found(self):
        self.db.query.return_value = make_query(None)
        with patch.object(services, "get_project_by_name", return_value=None):
            with self.assertRaises(UserNotFoundError):
                services.create_project(self.db, "project-1", "missing-admin")

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
        self.assertIn(user, project.users)

    def test_update_project_raises_when_not_found(self):
        with patch.object(services, "get_project_by_id_admin", return_value=None):
            with self.assertRaises(ProjectNotFoundError):
                services.update_project(self.db, "missing-id", "admin-id", name="x")

    def test_update_project_raises_when_duplicate_name(self):
        project = SimpleProject()
        other_project = SimpleProject(project_id="proj-2", name="existing-name")
        with (
            patch.object(services, "get_project_by_id_admin", return_value=project),
            patch.object(
                services, "get_project_by_name_admin", return_value=other_project
            ),
        ):
            with self.assertRaises(ProjectAlreadyExistsError):
                services.update_project(
                    self.db, project.id, "admin-id", name="existing-name"
                )

    def test_update_project_changes_fields(self):
        project = SimpleProject()
        with (
            patch.object(services, "get_project_by_id_admin", return_value=project),
            patch.object(services, "get_project_by_name_admin", return_value=None),
        ):
            updated = services.update_project(
                self.db,
                project.id,
                "admin-id",
                name="project-2",
                description="updated",
                is_finished=True,
            )

        self.assertEqual(updated.name, "project-2")
        self.assertEqual(updated.description, "updated")
        self.assertTrue(updated.is_finished)
        self.db.commit.assert_called_once()

    def test_delete_project_raises_when_not_found(self):
        with patch.object(services, "get_project_by_id_admin", return_value=None):
            with self.assertRaises(ProjectNotFoundError):
                services.delete_project(self.db, "missing-id", "admin-id")

    def test_delete_project_commits_and_returns_message(self):
        project = SimpleProject()
        with patch.object(services, "get_project_by_id_admin", return_value=project):
            result = services.delete_project(self.db, project.id, "admin-id")

        self.db.delete.assert_called_once_with(project)
        self.db.commit.assert_called_once()
        self.assertEqual(result, {"message": "Project deleted successfully"})

    def test_add_user_to_project_raises_when_project_missing(self):
        with patch.object(services, "get_project_by_id_admin", return_value=None):
            with self.assertRaises(ProjectNotFoundError):
                services.add_user_to_project(
                    self.db, "user-2", "missing-id", "admin-id"
                )

    def test_add_user_to_project_raises_when_user_missing(self):
        project = SimpleProject()
        self.db.query.return_value = make_query(None)
        with patch.object(services, "get_project_by_id_admin", return_value=project):
            with self.assertRaises(UserNotFoundError):
                services.add_user_to_project(
                    self.db, "missing-user", project.id, "admin-id"
                )

    def test_add_user_to_project_appends_user(self):
        project = SimpleProject()
        user = make_user(user_id="user-2")
        self.db.query.return_value = make_query(user)
        with patch.object(services, "get_project_by_id_admin", return_value=project):
            updated = services.add_user_to_project(
                self.db, "user-2", project.id, "admin-id"
            )

        self.db.commit.assert_called_once()
        self.assertIn(user, updated.users)

    def test_leave_project_raises_when_project_missing(self):
        self.db.query.return_value = make_query(None)
        with self.assertRaises(ProjectNotFoundError):
            services.leave_project(self.db, "missing-id", "user-2")

    def test_leave_project_raises_when_owner_leaves(self):
        project = SimpleProject(admin_id="owner-id")
        self.db.query.return_value = make_query(project)
        with self.assertRaises(OwnerCannotLeaveError):
            services.leave_project(self.db, project.id, "owner-id")

    def test_leave_project_removes_membership_and_user(self):
        project = SimpleProject(admin_id="owner-id")
        membership = Mock()
        user = make_user(user_id="user-2")
        project.users = [user]
        # Project lookup, then membership lookup, then user lookup.
        self.db.query.side_effect = [
            make_query(project),
            make_query(membership),
            make_query(user),
        ]

        services.leave_project(self.db, project.id, "user-2")

        self.assertNotIn(user, project.users)
        self.db.delete.assert_called_once_with(membership)
        self.db.commit.assert_called_once()


if __name__ == "__main__":
    unittest.main()
