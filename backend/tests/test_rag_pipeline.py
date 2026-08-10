from app.rag.pipeline import chunk_text, clean_text


def test_clean_text_removes_junk_and_whitespace():
    text = "\x00\x01Hello   world\r\n\n\n  \tNEXT LINE  "
    cleaned = clean_text(text)
    assert "\x00" not in cleaned
    assert "  " not in cleaned
    assert cleaned == "Hello world\nNEXT LINE"


def test_chunk_text_splits_long_paragraph():
    text = "word " * 5000
    chunks = chunk_text(text, size=1200, overlap=200)
    assert len(chunks) > 1
    assert all(len(c) <= 1200 for c in chunks)


def test_chunk_text_respects_overlap():
    text = "aaaa " * 1000
    chunks = chunk_text(text, size=500, overlap=100)
    assert len(chunks) > 1
    assert len(chunks[-1]) <= 500


def test_chunk_text_single_small_text():
    text = "Only a short paragraph here."
    assert chunk_text(text) == ["Only a short paragraph here."]
