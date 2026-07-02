import unittest
from datetime import datetime, timezone, timedelta
from unittest.mock import Mock, patch
from sqlalchemy.exc import IntegrityError

from src.modules.project_membership import services
from src.modules.project_membership.exceptions import (
    AlreadyMemberError,
    InvalidJoinCodeError,
    MemberNotFoundError,
    SelfRemovalError,
    UserNotFoundError,
)
from src.modules.project_membership.models import JoinCode, ProjectMembership
from src.core.enums import MembershipRole


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def make_query(result=None):
    """Return a mock that chains .filter(), .join(), .one_or_none(), .all()."""
    query = Mock()
    query.filter.return_value = query
    query.join.return_value = query
    query.one_or_none.return_value = result
    query.all.return_value = result if result is not None else []
    return query


def make_user(user_id="user-1", email="user@test.com"):
    user = Mock()
    user.id = user_id
    user.email = email
    user.is_active = True
    return user


def make_membership(
    project_id="proj-1", user_id="user-1", role=MembershipRole.PARTICIPANT
):
    m = Mock(spec=ProjectMembership)
    m.project_id = project_id
    m.user_id = user_id
    m.role = role
    return m


def make_join_code(code="ABCD1234", project_id="proj-1", expires_at=None):
    jc = Mock(spec=JoinCode)
    jc.code = code
    jc.project_id = project_id
    jc.expires_at = expires_at
    return jc


def sequential_db(results: list):
    """
    Return a db mock whose .query() calls return queries backed by successive
    entries from *results*.  Useful when a service function hits the DB more
    than once.
    """
    db = Mock()
    db.add = Mock()
    db.commit = Mock()
    db.rollback = Mock()
    db.delete = Mock()

    call_count = 0

    def side_effect(_model):
        nonlocal call_count
        r = results[min(call_count, len(results) - 1)]
        call_count += 1
        return make_query(r)

    db.query.side_effect = side_effect
    return db


# ---------------------------------------------------------------------------
# _generate_invite_code
# ---------------------------------------------------------------------------


class TestGenerateInviteCode(unittest.TestCase):
    def test_default_length_is_8(self):
        code = services._generate_invite_code()
        self.assertEqual(len(code), 8)

    def test_custom_length(self):
        code = services._generate_invite_code(12)
        self.assertEqual(len(code), 12)

    def test_only_uses_allowed_alphabet(self):
        for _ in range(30):
            code = services._generate_invite_code()
            for ch in code:
                self.assertIn(ch, services.INVITE_CODE_ALPHABET)

    def test_excludes_ambiguous_characters(self):
        # Alphabet excludes: 0, O, 1, I  (L is intentionally kept)
        for _ in range(50):
            code = services._generate_invite_code()
            for bad in ("0", "O", "1", "I"):
                self.assertNotIn(bad, code)


# ---------------------------------------------------------------------------
# _delete_existing_code
# ---------------------------------------------------------------------------


class TestDeleteExistingCode(unittest.TestCase):
    def setUp(self):
        self.db = Mock()
        self.db.delete = Mock()

    def test_deletes_when_code_exists(self):
        existing = make_join_code()
        self.db.query.return_value = make_query(existing)
        services._delete_existing_code(self.db, "proj-1")
        self.db.delete.assert_called_once_with(existing)

    def test_does_nothing_when_no_code(self):
        self.db.query.return_value = make_query(None)
        services._delete_existing_code(self.db, "proj-1")
        self.db.delete.assert_not_called()


# ---------------------------------------------------------------------------
# _add_user
# ---------------------------------------------------------------------------


class TestAddUser(unittest.TestCase):
    def setUp(self):
        self.db = Mock()
        self.db.add = Mock()

    def test_raises_already_member_when_membership_exists(self):
        self.db.query.return_value = make_query(make_membership())
        with self.assertRaises(AlreadyMemberError):
            services._add_user(self.db, "proj-1", "user-1")
        self.db.add.assert_not_called()

    def test_adds_participant_membership_when_not_a_member(self):
        self.db.query.return_value = make_query(None)
        services._add_user(self.db, "proj-1", "user-1")
        self.db.add.assert_called_once()
        added = self.db.add.call_args[0][0]
        self.assertIsInstance(added, ProjectMembership)
        self.assertEqual(added.project_id, "proj-1")
        self.assertEqual(added.user_id, "user-1")
        self.assertEqual(added.role, MembershipRole.PARTICIPANT)


# ---------------------------------------------------------------------------
# _get_user_or_raise
# ---------------------------------------------------------------------------


class TestGetUserOrRaise(unittest.TestCase):
    def setUp(self):
        self.db = Mock()

    def test_returns_user_by_email(self):
        user = make_user()
        self.db.query.return_value = make_query(user)
        result = services._get_user_or_raise(self.db, email="user@test.com")
        self.assertIs(result, user)

    def test_returns_user_by_user_id(self):
        user = make_user()
        self.db.query.return_value = make_query(user)
        result = services._get_user_or_raise(self.db, user_id="user-1")
        self.assertIs(result, user)

    def test_raises_user_not_found_when_email_missing(self):
        self.db.query.return_value = make_query(None)
        with self.assertRaises(UserNotFoundError):
            services._get_user_or_raise(self.db, email="missing@test.com")

    def test_raises_user_not_found_when_user_id_missing(self):
        self.db.query.return_value = make_query(None)
        with self.assertRaises(UserNotFoundError):
            services._get_user_or_raise(self.db, user_id="missing-id")

    def test_raises_user_not_found_when_nothing_provided(self):
        with self.assertRaises(UserNotFoundError):
            services._get_user_or_raise(self.db)


# ---------------------------------------------------------------------------
# get_user_role
# ---------------------------------------------------------------------------


class TestGetUserRole(unittest.TestCase):
    def setUp(self):
        self.db = Mock()

    def test_returns_role_when_member(self):
        membership = make_membership(role=MembershipRole.OWNER)
        self.db.query.return_value = make_query(membership)
        result = services.get_user_role(self.db, "proj-1", "user-1")
        self.assertEqual(result, MembershipRole.OWNER)

    def test_returns_participant_role(self):
        membership = make_membership(role=MembershipRole.PARTICIPANT)
        self.db.query.return_value = make_query(membership)
        result = services.get_user_role(self.db, "proj-1", "user-1")
        self.assertEqual(result, MembershipRole.PARTICIPANT)

    def test_returns_none_when_not_a_member(self):
        self.db.query.return_value = make_query(None)
        result = services.get_user_role(self.db, "proj-1", "unknown-user")
        self.assertIsNone(result)


# ---------------------------------------------------------------------------
# create_join_code
# ---------------------------------------------------------------------------


class TestCreateJoinCode(unittest.TestCase):
    def setUp(self):
        self.db = Mock()
        self.db.add = Mock()
        self.db.commit = Mock()
        self.db.refresh = Mock()
        self.db.delete = Mock()

    def test_creates_code_when_none_exists(self):
        self.db.query.return_value = make_query(None)
        services.create_join_code(self.db, "proj-1", "user-1")
        self.db.add.assert_called_once()
        self.db.commit.assert_called_once()
        self.db.refresh.assert_called_once()

    def test_added_object_has_correct_attributes(self):
        self.db.query.return_value = make_query(None)
        services.create_join_code(self.db, "proj-1", "user-1")
        added = self.db.add.call_args[0][0]
        self.assertIsInstance(added, JoinCode)
        self.assertEqual(added.project_id, "proj-1")
        self.assertEqual(added.created_by, "user-1")
        self.assertIsNone(added.expires_at)

    def test_replaces_existing_code(self):
        existing = make_join_code()
        self.db.query.return_value = make_query(existing)
        services.create_join_code(self.db, "proj-1", "user-1")
        self.db.delete.assert_called_once_with(existing)
        self.db.add.assert_called_once()

    def test_sets_expires_at_when_provided(self):
        self.db.query.return_value = make_query(None)
        future = datetime.now(timezone.utc) + timedelta(hours=2)
        services.create_join_code(self.db, "proj-1", "user-1", expires_at=future)
        added = self.db.add.call_args[0][0]
        self.assertEqual(added.expires_at, future)

    def test_generated_code_uses_allowed_alphabet(self):
        self.db.query.return_value = make_query(None)
        services.create_join_code(self.db, "proj-1", "user-1")
        added = self.db.add.call_args[0][0]
        for ch in added.code:
            self.assertIn(ch, services.INVITE_CODE_ALPHABET)


# ---------------------------------------------------------------------------
# join_project
# ---------------------------------------------------------------------------


class TestJoinProject(unittest.TestCase):
    def test_raises_invalid_code_when_code_not_found(self):
        db = sequential_db([None])
        with self.assertRaises(InvalidJoinCodeError):
            services.join_project(db, "BADCODE", "user-1")

    def test_raises_invalid_code_when_expired(self):
        expired = make_join_code(
            expires_at=datetime.now(timezone.utc) - timedelta(seconds=1)
        )
        db = sequential_db([expired])
        with self.assertRaises(InvalidJoinCodeError):
            services.join_project(db, "ABCD1234", "user-1")

    def test_raises_already_member_when_user_is_in_project(self):
        valid_code = make_join_code(project_id="proj-1")
        membership = make_membership(project_id="proj-1")
        db = sequential_db([valid_code, membership])
        with self.assertRaises(AlreadyMemberError):
            services.join_project(db, "ABCD1234", "user-1")

    def test_returns_project_id_on_success(self):
        valid_code = make_join_code(project_id="proj-42")
        db = sequential_db([valid_code, None])
        with patch("src.modules.project_membership.services.redis_client"):
            result = services.join_project(db, "ABCD1234", "user-1")
        self.assertEqual(result, {"project_id": "proj-42"})
        db.commit.assert_called_once()

    def test_code_without_expiry_is_always_valid(self):
        valid_code = make_join_code(project_id="proj-1", expires_at=None)
        db = sequential_db([valid_code, None])
        with patch("src.modules.project_membership.services.redis_client"):
            result = services.join_project(db, "ABCD1234", "user-1")
        self.assertIn("project_id", result)

    def test_future_expiry_is_valid(self):
        future_code = make_join_code(
            project_id="proj-1",
            expires_at=datetime.now(timezone.utc) + timedelta(hours=1),
        )
        db = sequential_db([future_code, None])
        with patch("src.modules.project_membership.services.redis_client"):
            result = services.join_project(db, "ABCD1234", "user-1")
        self.assertEqual(result["project_id"], "proj-1")

    def test_raises_already_member_on_integrity_error(self):
        valid_code = make_join_code(project_id="proj-1")
        db = sequential_db([valid_code, None])
        db.commit.side_effect = IntegrityError(None, None, Exception("unique"))
        with self.assertRaises(AlreadyMemberError):
            services.join_project(db, "ABCD1234", "user-1")
        db.rollback.assert_called_once()


# ---------------------------------------------------------------------------
# invite_user_by_email
# ---------------------------------------------------------------------------


class TestInviteUserByEmail(unittest.TestCase):
    def test_raises_user_not_found_when_email_unknown(self):
        db = sequential_db([None])
        with self.assertRaises(UserNotFoundError):
            services.invite_user_by_email(db, "proj-1", "missing@test.com")

    def test_raises_already_member_when_user_already_in_project(self):
        user = make_user()
        existing_membership = make_membership(user_id=user.id)
        db = sequential_db([user, existing_membership])
        with self.assertRaises(AlreadyMemberError):
            services.invite_user_by_email(db, "proj-1", "user@test.com")

    def test_returns_success_message_on_invite(self):
        user = make_user()
        db = sequential_db([user, None])
        with patch("src.modules.project_membership.services.redis_client"):
            result = services.invite_user_by_email(db, "proj-1", "user@test.com")
        self.assertEqual(result, {"message": "User invited successfully"})
        db.commit.assert_called_once()

    def test_rollback_called_on_db_error(self):
        user = make_user()
        db = sequential_db([user, None])
        db.commit.side_effect = Exception("db error")
        with self.assertRaises(Exception):
            services.invite_user_by_email(db, "proj-1", "user@test.com")
        db.rollback.assert_called_once()

    def test_raises_already_member_on_integrity_error(self):
        user = make_user()
        db = sequential_db([user, None])
        db.commit.side_effect = IntegrityError(None, None, Exception("unique"))
        with self.assertRaises(AlreadyMemberError):
            services.invite_user_by_email(db, "proj-1", "user@test.com")
        db.rollback.assert_called_once()


# ---------------------------------------------------------------------------
# get_users
# ---------------------------------------------------------------------------


class TestGetUsers(unittest.TestCase):
    def _make_db_with_join_chain(self, return_value):
        db = Mock()
        query = Mock()
        query.join.return_value = query
        query.filter.return_value = query
        query.all.return_value = return_value
        db.query.return_value = query
        return db

    def test_returns_users_wrapped_in_dict(self):
        user1 = make_user("u1", "u1@test.com")
        user2 = make_user("u2", "u2@test.com")
        rows = [
            (user1, MembershipRole.OWNER),
            (user2, MembershipRole.PARTICIPANT),
        ]
        db = self._make_db_with_join_chain(rows)
        result = services.get_users(db, "proj-1")
        self.assertEqual(
            result,
            {
                "users": [
                    {
                        "id": "u1",
                        "email": "u1@test.com",
                        "is_active": True,
                        "role": MembershipRole.OWNER.value,
                    },
                    {
                        "id": "u2",
                        "email": "u2@test.com",
                        "is_active": True,
                        "role": MembershipRole.PARTICIPANT.value,
                    },
                ]
            },
        )

    def test_returns_empty_list_when_no_members(self):
        db = self._make_db_with_join_chain([])
        result = services.get_users(db, "proj-1")
        self.assertEqual(result, {"users": []})


# ---------------------------------------------------------------------------
# remove_user
# ---------------------------------------------------------------------------


class TestRemoveUser(unittest.TestCase):
    def test_raises_self_removal_error_when_caller_removes_themselves(self):
        db = Mock()
        with self.assertRaises(SelfRemovalError):
            services.remove_user(db, "proj-1", "user-1", caller_id="user-1")
        db.query.assert_not_called()

    def test_raises_user_not_found_when_user_does_not_exist(self):
        db = sequential_db([None])
        with self.assertRaises(UserNotFoundError):
            services.remove_user(db, "proj-1", "missing-user", caller_id="owner-1")

    def test_raises_member_not_found_when_not_in_project(self):
        user = make_user()
        db = sequential_db([user, None])
        with self.assertRaises(MemberNotFoundError):
            services.remove_user(db, "proj-1", "user-1", caller_id="owner-1")

    def test_deletes_membership_and_returns_message(self):
        user = make_user()
        membership = make_membership()
        db = sequential_db([user, membership])
        with patch("src.modules.project_membership.services.redis_client"):
            result = services.remove_user(db, "proj-1", "user-1", caller_id="owner-1")
        db.delete.assert_called_once_with(membership)
        db.commit.assert_called_once()
        self.assertEqual(result, {"message": "User removed from project"})

    def test_rollback_called_on_db_error(self):
        user = make_user()
        membership = make_membership()
        db = sequential_db([user, membership])
        db.commit.side_effect = Exception("db error")
        with self.assertRaises(Exception):
            services.remove_user(db, "proj-1", "user-1", caller_id="owner-1")
        db.rollback.assert_called_once()
