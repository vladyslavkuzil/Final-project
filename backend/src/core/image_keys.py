from pathlib import Path


def resized_key(original_key: str) -> str | None:
    """Map an original S3 key to the image_resize lambda's output key.

    Mirrors the lambda's rules: only original/-prefixed jpg/jpeg/png keys are
    processed, and jpeg output always lands under a .jpg extension. Returns
    None for keys the lambda never touches (including local-storage keys).
    """
    if not original_key.startswith("original/"):
        return None
    ext = Path(original_key).suffix.lower()
    key = original_key.replace("original/", "resized/", 1)
    if ext in (".jpg", ".jpeg"):
        return str(Path(key).with_suffix(".jpg"))
    if ext == ".png":
        return key
    return None
