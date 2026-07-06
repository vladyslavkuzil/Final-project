from __future__ import annotations

import asyncio
from datetime import datetime
from types import SimpleNamespace
from unittest.mock import AsyncMock, Mock, patch

import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError

from src.modules.chat import services as chat_services
from src.modules.chat.manager import ConnectionManager
from src.modules.chat.schemas import WSMessageIn
from src.modules.chat.ws import manager as ws_manager


class DummyWebSocket:
    def __init__(self):
        self.accept = AsyncMock()
        self.send_json = AsyncMock()


def _mock_query(result=None):
    query = Mock()
    query.options.return_value = query
    query.filter.return_value = query
    query.order_by.return_value = query
    query.offset.return_value = query
    query.limit.return_value = query
    query.first.return_value = result
    query.all.return_value = result
    return query


@pytest.fixture(autouse=True)
def clear_ws_manager_state():
    ws_manager.active_connections.clear()
    yield
    ws_manager.active_connections.clear()


class TestChatServices:
    def test_get_messages_caps_limit_and_filters_deleted(self):
        db = Mock()
        db.query.return_value = _mock_query([])

        result = chat_services.get_messages(
            project_id="project-1",
            offset=10,
            limit=999,
            db=db,
        )

        assert result == []
        query = db.query.return_value
        assert query.filter.call_count == 2
        query.limit.assert_called_once_with(100)
        query.offset.assert_called_once_with(10)
        query.order_by.assert_called_once()

    def test_create_message_persists_and_returns_message(self):
        db = Mock()
        message = SimpleNamespace(
            id="msg-1",
            project_id="project-1",
            sender_id="user-1",
            content="hello",
            created_at=datetime(2026, 7, 1, 12, 0, 0),
        )

        with patch(
            "src.modules.chat.services.Message", return_value=message
        ) as message_cls:
            result = chat_services.create_message(
                project_id="project-1",
                user_id="user-1",
                content="hello",
                db=db,
            )

        message_cls.assert_called_once_with(
            project_id="project-1",
            sender_id="user-1",
            content="hello",
        )
        db.add.assert_called_once_with(message)
        db.commit.assert_called_once()
        db.refresh.assert_called_once_with(message)
        assert result is message

    def test_update_message_rejects_unknown_message(self):
        db = Mock()
        db.query.return_value = _mock_query(None)

        result = chat_services.update_message(
            message_id="missing",
            user_id="user-1",
            content="new",
            db=db,
        )

        assert result is None

    def test_update_project_message_changes_content_for_owner(self):
        db = Mock()
        message = SimpleNamespace(
            id="msg-1",
            sender_id="user-1",
            content="old",
            updated_at=None,
        )
        db.query.return_value = _mock_query(message)

        result = chat_services.update_message(
            message_id="msg-1",
            user_id="user-1",
            content="new",
            db=db,
        )

        assert result is message
        assert message.content == "new"
        assert message.updated_at is not None
        db.commit.assert_called_once()
        db.refresh.assert_called_once_with(message)

    def test_delete_project_message_marks_message_deleted(self):
        db = Mock()
        message = SimpleNamespace(
            id="msg-1",
            sender_id="user-1",
            deleted_at=None,
        )
        db.query.return_value = _mock_query(message)

        result = chat_services.delete_message(
            message_id="msg-1",
            user_id="user-1",
            db=db,
        )

        assert result is message
        assert isinstance(message.deleted_at, datetime)
        db.commit.assert_called_once()
        db.refresh.assert_called_once_with(message)


class TestConnectionManager:
    def test_connect_registers_websocket(self):
        manager = ConnectionManager()
        websocket = DummyWebSocket()

        asyncio.run(manager.connect("project-1", websocket))

        websocket.accept.assert_awaited_once()
        assert websocket in manager.active_connections["project-1"]

    def test_broadcast_sends_to_all_active_connections(self):
        manager = ConnectionManager()
        websocket = DummyWebSocket()
        manager.active_connections["project-1"].add(websocket)

        asyncio.run(
            manager.broadcast("project-1", {"type": "message", "content": "hi"})
        )

        websocket.send_json.assert_awaited_once_with(
            {"type": "message", "content": "hi"}
        )

    def test_broadcast_removes_dead_connections(self):
        manager = ConnectionManager()
        websocket = DummyWebSocket()

        async def fail(*args, **kwargs):
            raise RuntimeError("socket closed")

        websocket.send_json.side_effect = fail
        manager.active_connections["project-1"].add(websocket)

        asyncio.run(
            manager.broadcast("project-1", {"type": "message", "content": "hi"})
        )

        assert "project-1" not in manager.active_connections


def test_ws_message_in_validation_accepts_message_payload():
    message = WSMessageIn.model_validate_json('{"type":"message","content":"hi"}')

    assert message.type == "message"
    assert message.content == "hi"


def test_ws_message_in_validation_rejects_empty_payload():
    with pytest.raises(ValidationError):
        WSMessageIn.model_validate_json("{}")


def test_project_chat_ws_broadcasts_message(client: TestClient):
    fake_db = Mock()
    fake_db.query.return_value.filter.return_value.scalar.return_value = (
        "user-1@example.com"
    )
    fake_message = SimpleNamespace(
        id="msg-1",
        project_id="project-1",
        sender_id="user-1",
        content="hello from websocket",
        created_at=datetime(2026, 7, 1, 12, 0, 0),
    )

    with (
        patch("src.modules.chat.ws.get_user_id_from_token", return_value="user-1"),
        patch("src.modules.chat.ws.verify_project_access", return_value=True),
        patch("src.modules.chat.ws.SessionLocal", return_value=fake_db),
        patch(
            "src.modules.chat.ws.service.create_message", return_value=fake_message
        ) as create_message,
    ):
        with client.websocket_connect(
            "/api/ws/projects/project-1?token=test-token"
        ) as websocket:
            websocket.send_text('{"type":"message","content":"hello from websocket"}')
            data = websocket.receive_json()

    create_message.assert_called_once_with(
        project_id="project-1",
        user_id="user-1",
        content="hello from websocket",
        db=fake_db,
    )
    assert data["type"] == "message"
    assert data["content"] == "hello from websocket"
    assert data["project_id"] == "project-1"
    assert data["sender_id"] == "user-1"
    assert data["sender_email"] == "user-1@example.com"
