from redis import Redis
from src.core.config import REDIS_HOST, REDIS_PORT, REDIS_DB, REDIS_PASSWORD

redis_client = Redis(
    host=REDIS_HOST,
    port=REDIS_PORT,
    db=REDIS_DB,
    password=REDIS_PASSWORD,
    decode_responses=True,
)
