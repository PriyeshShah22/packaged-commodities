from io import BytesIO
import pytest
from starlette.datastructures import UploadFile, Headers
from app import api


@pytest.mark.parametrize('live,text_only,qr_calls', [(True, False, 0), (False, True, 0), (False, False, 1)])
def test_text_only_skips_qr_but_uploads_keep_it(monkeypatch, live, text_only, qr_calls):
    calls = []
    monkeypatch.setattr(api, 'run_ocr', lambda *args, **kwargs: ([{'text': 'MRP Rs. 230', 'confidence': .96, 'image_id': 'IMG-001', 'bbox': [0, 0, 200, 20]}], {}))
    monkeypatch.setattr(api, '_qr_lines', lambda *args: calls.append(True) or [])
    upload = UploadFile(BytesIO(b'test'), filename='frame.jpg', headers=Headers({'content-type': 'image/jpeg'}))
    result = api.extract_image_declarations(files=[upload], live=live, text_only=text_only, _=None)
    assert result['total_lines'] == 1
    assert len(calls) == qr_calls
    assert '230' in result['fields']['mrp']['value']


def test_busy_live_reader_rejects_duplicate_request(monkeypatch):
    calls = []
    monkeypatch.setattr(api, 'run_ocr', lambda *args, **kwargs: calls.append(True))
    upload = UploadFile(BytesIO(b'test'), filename='frame.jpg', headers=Headers({'content-type': 'image/jpeg'}))
    assert api.LIVE_REQUEST_LOCK.acquire(blocking=False)
    try:
        with pytest.raises(api.HTTPException) as failure:
            api.extract_image_declarations(files=[upload], live=True, text_only=True, _=None)
        assert failure.value.status_code == 429
        assert calls == []
    finally:
        api.LIVE_REQUEST_LOCK.release()


def test_failed_live_reader_releases_lock(monkeypatch):
    def fail(*args, **kwargs):
        raise RuntimeError('test OCR failure')
    monkeypatch.setattr(api, 'run_ocr', fail)
    upload = UploadFile(BytesIO(b'test'), filename='frame.jpg', headers=Headers({'content-type': 'image/jpeg'}))
    with pytest.raises(RuntimeError):
        api.extract_image_declarations(files=[upload], live=True, text_only=True, _=None)
    assert api.LIVE_REQUEST_LOCK.acquire(blocking=False)
    api.LIVE_REQUEST_LOCK.release()
